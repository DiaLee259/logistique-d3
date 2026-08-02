import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StockCalculatorService } from '../stock-calculator.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class InventairesService {
  constructor(
    private prisma: PrismaService,
    private calculator: StockCalculatorService,
  ) {}

  async findAll(filters: { entrepotId?: string; articleId?: string; mois?: string }) {
    const where: any = {};
    if (filters.entrepotId) where.entrepotId = filters.entrepotId;
    if (filters.articleId) where.articleId = filters.articleId;
    if ((filters as any).userEntrepots?.length) {
      where.entrepotId = { in: (filters as any).userEntrepots };
    }
    if (filters.mois) {
      const [y, m] = filters.mois.split('-').map(Number);
      where.date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    }
    return this.prisma.inventairePhysique.findMany({
      where,
      include: {
        article: { select: { id: true, nom: true, reference: true, unite: true } },
      },
      orderBy: { date: 'desc' },
    });
  }


  // Vue consolidée par entrepôt : tous les articles actifs + stock théorique (mouvements) + dernier inventaire
  async getEtatParEntrepot(entrepotId: string) {
    const articles = await this.prisma.article.findMany({
      where: { actif: true },
      select: { id: true, nom: true, reference: true, unite: true, seuilAlerte: true },
      orderBy: { nom: 'asc' },
    });

    const result = await Promise.all(articles.map(async (article) => {
      // Stock théorique = toujours calculé depuis les mouvements
      const [entrees, sorties, dernierInventaire] = await Promise.all([
        this.prisma.mouvement.aggregate({
          where: { entrepotId, articleId: article.id, type: 'ENTREE' as any },
          _sum: { quantiteFournie: true },
        }),
        this.prisma.mouvement.aggregate({
          where: { entrepotId, articleId: article.id, type: 'SORTIE' as any },
          _sum: { quantiteFournie: true },
        }),
        this.prisma.inventairePhysique.findFirst({
          where: { entrepotId, articleId: article.id },
          orderBy: { date: 'desc' },
        }),
      ]);

      const stockTheorique = (entrees._sum.quantiteFournie ?? 0) - (sorties._sum.quantiteFournie ?? 0);

      return {
        articleId: article.id,
        article,
        stockTheorique,
        dernierInventaire: dernierInventaire
          ? { quantite: dernierInventaire.quantite, date: dernierInventaire.date, commentaire: dernierInventaire.commentaire }
          : null,
        ecart: dernierInventaire ? dernierInventaire.quantite - stockTheorique : null,
      };
    }));

    return result;
  }

  // Alertes : entrepôts sans inventaire depuis plus de 3 mois
  async getAlertes(userEntrepots?: string[]) {
    const where: any = { actif: true };
    if (userEntrepots?.length) where.id = { in: userEntrepots };
    const entrepots = await this.prisma.entrepot.findMany({ where });
    const troixMoisAvant = new Date();
    troixMoisAvant.setMonth(troixMoisAvant.getMonth() - 3);

    const alertes = await Promise.all(entrepots.map(async (e) => {
      const dernierInventaire = await this.prisma.inventairePhysique.findFirst({
        where: { entrepotId: e.id },
        orderBy: { date: 'desc' },
      });

      const enAlerte = !dernierInventaire || dernierInventaire.date < troixMoisAvant;
      return { entrepot: e, dernierInventaire: dernierInventaire?.date ?? null, enAlerte };
    }));

    // Envoyer notification si pas déjà envoyée dans les 7 derniers jours
    const septJoursAvant = new Date();
    septJoursAvant.setDate(septJoursAvant.getDate() - 7);

    for (const alerte of alertes.filter(a => a.enAlerte)) {
      const dejaNotifie = await this.prisma.notification.findFirst({
        where: {
          type: 'INVENTAIRE_ALERTE',
          message: { contains: alerte.entrepot.id },
          createdAt: { gte: septJoursAvant },
        },
      });
      if (!dejaNotifie) {
        await this.prisma.notification.create({
          data: {
            type: 'INVENTAIRE_ALERTE',
            titre: `⚠ Inventaire requis — ${alerte.entrepot.code}`,
            message: `Aucun inventaire physique réalisé depuis plus de 3 mois pour l'entrepôt ${alerte.entrepot.nom} (${alerte.entrepot.id}). Délai : 1 semaine.`,
            lien: '/inventaire',
          },
        });
      }
    }

    return alertes;
  }

  async create(data: { entrepotId: string; lignes: { articleId: string; quantite: number; commentaire?: string }[] }, userId?: string) {
    const now = new Date();
    const created = await Promise.all(
      data.lignes.map(l =>
        this.prisma.inventairePhysique.create({
          data: {
            entrepotId: data.entrepotId,
            articleId: l.articleId,
            quantite: l.quantite,
            commentaire: l.commentaire,
            userId,
            date: now,
          },
          include: { article: { select: { id: true, nom: true, reference: true } } },
        })
      )
    );
    // Recalculer le stock avec la formule hybride pour chaque article
    for (const l of data.lignes) {
      await this.calculator.sync(l.articleId, data.entrepotId);
    }
    return created;
  }

  /** Retourne tous les articles (actifs en premier, puis inactifs) triés par nom */
  async getAllArticlesForTemplate() {
    const articles = await this.prisma.article.findMany({
      select: { id: true, reference: true, nom: true, actif: true },
      orderBy: [{ actif: 'desc' }, { nom: 'asc' }],
    });
    return articles;
  }

  async deleteOne(id: string) {
    const inv = await this.prisma.inventairePhysique.findUnique({ where: { id } });
    if (!inv) return { deleted: 0 };
    await this.prisma.inventairePhysique.delete({ where: { id } });
    await this.calculator.sync(inv.articleId, inv.entrepotId);
    return { deleted: 1 };
  }

  async deleteBulk(ids: string[]) {
    const records = await this.prisma.inventairePhysique.findMany({
      where: { id: { in: ids } },
      select: { articleId: true, entrepotId: true },
    });

    const result = await this.prisma.inventairePhysique.deleteMany({ where: { id: { in: ids } } });

    const pairs = new Map<string, { articleId: string; entrepotId: string }>();
    for (const r of records) {
      pairs.set(`${r.articleId}:${r.entrepotId}`, r);
    }
    for (const pair of pairs.values()) {
      await this.calculator.sync(pair.articleId, pair.entrepotId);
    }
    return { deleted: result.count };
  }

  async importInventaire(buffer: Buffer, userId?: string) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    if (!ws) return { created: 0, skipped: 0, errors: ['Fichier Excel vide ou invalide'], total: 0 };

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    const rows: ExcelJS.Row[] = [];
    ws.eachRow((row, idx) => { if (idx > 1) rows.push(row); });

    for (const row of rows) {
      const codeEntrepot = String(row.getCell(1).value ?? '').trim();
      const refArticle   = String(row.getCell(2).value ?? '').trim();
      // col 3 = Nom article (info, ignorée)
      const rawQte = row.getCell(4).value;
      const quantite = rawQte !== null && rawQte !== undefined ? (parseInt(String(rawQte)) || 0) : null;
      const commentaire = String(row.getCell(5).value ?? '').trim() || undefined;

      if (!codeEntrepot || !refArticle) { skipped++; continue; }
      if (quantite === null || quantite === undefined) {
        errors.push(`Quantité manquante pour ${refArticle}`); skipped++; continue;
      }

      const entrepot = await this.prisma.entrepot.findFirst({ where: { code: codeEntrepot } });
      if (!entrepot) { errors.push(`Entrepôt introuvable : "${codeEntrepot}"`); skipped++; continue; }

      const article = await this.prisma.article.findFirst({ where: { reference: refArticle } });
      if (!article) { errors.push(`Article introuvable : "${refArticle}"`); skipped++; continue; }

      try {
        await this.prisma.inventairePhysique.create({
          data: {
            entrepotId: entrepot.id,
            articleId: article.id,
            quantite,
            commentaire,
            userId: userId ?? null,
            date: new Date(),
          },
        });
        // Recalculer avec formule hybride (inventaire comme nouvelle base)
        await this.calculator.sync(article.id, entrepot.id);
        created++;
      } catch (err: any) {
        errors.push(`Erreur ligne ${refArticle}/${codeEntrepot} : ${err?.message ?? String(err)}`);
        skipped++;
      }
    }
    return { created, skipped, errors, total: rows.length };
  }
}
