import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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
    const where: any = { deletedAt: null };
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
      // Stock théorique = toujours calculé depuis les mouvements (hors supprimés)
      const [entrees, sorties, dernierInventaire] = await Promise.all([
        this.prisma.mouvement.aggregate({
          where: { entrepotId, articleId: article.id, type: 'ENTREE' as any, deletedAt: null },
          _sum: { quantiteFournie: true },
        }),
        this.prisma.mouvement.aggregate({
          where: { entrepotId, articleId: article.id, type: 'SORTIE' as any, deletedAt: null },
          _sum: { quantiteFournie: true },
        }),
        this.prisma.inventairePhysique.findFirst({
          where: { entrepotId, articleId: article.id, deletedAt: null },
          orderBy: { date: 'desc' },
        }),
      ]);

      const stockTheorique = (entrees._sum.quantiteFournie ?? 0) - (sorties._sum.quantiteFournie ?? 0);

      return {
        articleId: article.id,
        article,
        stockTheorique,
        dernierInventaire: dernierInventaire
          ? { id: dernierInventaire.id, quantite: dernierInventaire.quantite, date: dernierInventaire.date, commentaire: dernierInventaire.commentaire }
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
        where: { entrepotId: e.id, deletedAt: null },
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

  /** Mise à jour d'un seul article dans l'inventaire — sans toucher les autres */
  async updateArticle(data: { entrepotId: string; articleId: string; quantite: number; commentaire?: string }, userId?: string) {
    const created = await this.prisma.inventairePhysique.create({
      data: {
        entrepotId: data.entrepotId,
        articleId: data.articleId,
        quantite: data.quantite,
        commentaire: data.commentaire,
        userId: userId ?? null,
        date: new Date(),
      },
      include: { article: { select: { id: true, nom: true, reference: true } } },
    });
    await this.calculator.sync(data.articleId, data.entrepotId);
    return created;
  }

  /** Corriger la quantité d'un inventaire existant (délai 3 jours, commentaire obligatoire) */
  async corrigerInventaire(
    inventaireId: string,
    data: { quantiteNouvelle: number; commentaire: string },
    userId?: string,
  ) {
    if (!data.commentaire?.trim()) {
      throw new BadRequestException('Le commentaire est obligatoire pour une correction');
    }

    const inv = await this.prisma.inventairePhysique.findUnique({ where: { id: inventaireId } });
    if (!inv || inv.deletedAt) throw new NotFoundException('Inventaire introuvable');

    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    if (Date.now() - inv.date.getTime() > threeDaysMs) {
      throw new BadRequestException('Délai de correction dépassé (3 jours) — créez un nouvel inventaire');
    }

    let correctedByName = 'Inconnu';
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { prenom: true, nom: true } });
      if (user) correctedByName = `${user.prenom} ${user.nom}`;
    }

    await this.prisma.$transaction([
      this.prisma.inventairePhysique.update({
        where: { id: inventaireId },
        data: { quantite: data.quantiteNouvelle },
      }),
      this.prisma.correctionInventaire.create({
        data: {
          inventaireId,
          quantiteAvant: inv.quantite,
          quantiteApres: data.quantiteNouvelle,
          commentaire: data.commentaire.trim(),
          correctedById: userId ?? null,
          correctedByName,
        },
      }),
    ]);

    await this.calculator.sync(inv.articleId, inv.entrepotId);
    return { success: true };
  }

  async getCorrections(inventaireId: string) {
    return this.prisma.correctionInventaire.findMany({
      where: { inventaireId },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async stockAtDate(articleId: string, entrepotId: string, targetDate: Date): Promise<number> {
    const dernierInventaire = await this.prisma.inventairePhysique.findFirst({
      where: { articleId, entrepotId, date: { lte: targetDate }, deletedAt: null },
      orderBy: { date: 'desc' },
    });
    const baseQte = dernierInventaire?.quantite ?? 0;
    const fromDate = dernierInventaire?.date ?? new Date(0);
    const [entrees, sorties] = await Promise.all([
      this.prisma.mouvement.aggregate({
        where: { articleId, entrepotId, type: 'ENTREE' as any, date: { gt: fromDate, lte: targetDate }, deletedAt: null },
        _sum: { quantiteFournie: true },
      }),
      this.prisma.mouvement.aggregate({
        where: { articleId, entrepotId, type: 'SORTIE' as any, date: { gt: fromDate, lte: targetDate }, deletedAt: null },
        _sum: { quantiteFournie: true },
      }),
    ]);
    return baseQte + (entrees._sum.quantiteFournie ?? 0) - (sorties._sum.quantiteFournie ?? 0);
  }

  async getRapportStock(params: { dateDebut: string; dateFin: string; entrepotId?: string; articleId?: string; format?: string }): Promise<Buffer | any[]> {
    const dateDebutEOD = new Date(params.dateDebut);
    dateDebutEOD.setHours(23, 59, 59, 999);
    const dateFinEOD = new Date(params.dateFin);
    dateFinEOD.setHours(23, 59, 59, 999);

    const whereEntrepot: any = { actif: true };
    if (params.entrepotId) whereEntrepot.id = params.entrepotId;
    const whereArticle: any = { actif: true };
    if (params.articleId) whereArticle.id = params.articleId;

    const [entrepots, articles] = await Promise.all([
      this.prisma.entrepot.findMany({ where: whereEntrepot, orderBy: { code: 'asc' } }),
      this.prisma.article.findMany({ where: whereArticle, orderBy: { nom: 'asc' } }),
    ]);

    const entrepotIds = entrepots.map(e => e.id);
    const articleIds = articles.map(a => a.id);

    // Tous les inventaires jusqu'à dateFinEOD — on en dérive les deux maps (début ET fin)
    const allInventaires = await this.prisma.inventairePhysique.findMany({
      where: { articleId: { in: articleIds }, entrepotId: { in: entrepotIds }, date: { lte: dateFinEOD }, deletedAt: null },
      orderBy: { date: 'desc' },
      select: { articleId: true, entrepotId: true, quantite: true, date: true },
    });
    const lastInvBeforeDebutMap = new Map<string, { quantite: number; date: Date }>();
    const lastInvBeforeFinMap = new Map<string, { quantite: number; date: Date }>();
    for (const inv of allInventaires) {
      const key = `${inv.articleId}:${inv.entrepotId}`;
      if (!lastInvBeforeFinMap.has(key)) lastInvBeforeFinMap.set(key, { quantite: inv.quantite, date: inv.date });
      if (inv.date <= dateDebutEOD && !lastInvBeforeDebutMap.has(key)) lastInvBeforeDebutMap.set(key, { quantite: inv.quantite, date: inv.date });
    }

    // Tous les mouvements jusqu'à dateFinEOD
    const allMouvements = await this.prisma.mouvement.findMany({
      where: { articleId: { in: articleIds }, entrepotId: { in: entrepotIds }, date: { lte: dateFinEOD }, deletedAt: null },
      select: { articleId: true, entrepotId: true, type: true, quantiteFournie: true, date: true },
    });
    const mouvByKey = new Map<string, typeof allMouvements>();
    for (const m of allMouvements) {
      const key = `${m.articleId}:${m.entrepotId}`;
      if (!mouvByKey.has(key)) mouvByKey.set(key, []);
      mouvByKey.get(key)!.push(m);
    }

    type Row = { entrepot: string; article: string; reference: string; unite: string; stockDebut: number; entrees: number; sorties: number; stockFin: number };
    const rows: Row[] = [];

    for (const entrepot of entrepots) {
      for (const article of articles) {
        const key = `${article.id}:${entrepot.id}`;

        // stockDebut : formule hybride à dateDebutEOD
        const lastInvDebut = lastInvBeforeDebutMap.get(key);
        const fromDateDebut = lastInvDebut?.date ?? new Date(0);
        let stockDebut = lastInvDebut?.quantite ?? 0;

        // stockFin : formule hybride indépendante à dateFinEOD (corrige le bug précédent)
        const lastInvFin = lastInvBeforeFinMap.get(key);
        const fromDateFin = lastInvFin?.date ?? new Date(0);
        let stockFin = lastInvFin?.quantite ?? 0;

        let entrees = 0;
        let sorties = 0;

        for (const m of mouvByKey.get(key) ?? []) {
          const qty = m.quantiteFournie ?? 0;
          const isEntree = (m.type as string) === 'ENTREE';
          if (m.date > fromDateDebut && m.date <= dateDebutEOD) stockDebut += isEntree ? qty : -qty;
          if (m.date > fromDateFin && m.date <= dateFinEOD) stockFin += isEntree ? qty : -qty;
          if (m.date > dateDebutEOD && m.date <= dateFinEOD) {
            if (isEntree) entrees += qty; else sorties += qty;
          }
        }

        if (stockDebut === 0 && entrees === 0 && sorties === 0 && stockFin === 0) continue;
        rows.push({ entrepot: entrepot.code, article: article.nom, reference: article.reference, unite: article.unite, stockDebut, entrees, sorties, stockFin });
      }
    }

    if (params.format === 'json') return rows;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Rapport de stock');
    ws.columns = [
      { header: 'Entrepôt', key: 'entrepot', width: 12 },
      { header: 'Article', key: 'article', width: 40 },
      { header: 'Référence', key: 'reference', width: 18 },
      { header: 'Unité', key: 'unite', width: 8 },
      { header: `Stock au ${params.dateDebut}`, key: 'stockDebut', width: 20 },
      { header: `Entrées (${params.dateDebut} → ${params.dateFin})`, key: 'entrees', width: 26 },
      { header: `Sorties (${params.dateDebut} → ${params.dateFin})`, key: 'sorties', width: 26 },
      { header: `Stock au ${params.dateFin}`, key: 'stockFin', width: 20 },
    ];
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6E' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    headerRow.height = 45;

    let rowNum = 1;
    for (const row of rows) {
      rowNum++;
      const r = ws.addRow(row);
      r.alignment = { vertical: 'middle' };
      if (rowNum % 2 === 0) r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FC' } };
      const cellFin = r.getCell('stockFin');
      if (row.stockFin < row.stockDebut) cellFin.font = { color: { argb: 'FFCC0000' }, bold: true };
      else if (row.stockFin > row.stockDebut) cellFin.font = { color: { argb: 'FF007700' }, bold: true };
      else cellFin.font = { bold: true };
    }
    ws.eachRow(r => r.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D7E4' } }, bottom: { style: 'thin', color: { argb: 'FFD0D7E4' } },
        left: { style: 'thin', color: { argb: 'FFD0D7E4' } }, right: { style: 'thin', color: { argb: 'FFD0D7E4' } },
      };
    }));
    return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  async deleteOne(id: string, userId?: string) {
    const inv = await this.prisma.inventairePhysique.findUnique({ where: { id } });
    if (!inv) return { deleted: 0 };
    let deletedByName = 'Inconnu';
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { prenom: true, nom: true } });
      if (user) deletedByName = `${user.prenom} ${user.nom}`;
    }
    await this.prisma.inventairePhysique.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId ?? null, deletedByName },
    });
    await this.calculator.sync(inv.articleId, inv.entrepotId);
    return { deleted: 1 };
  }

  async deleteBulk(ids: string[], userId?: string) {
    const records = await this.prisma.inventairePhysique.findMany({
      where: { id: { in: ids } },
      select: { id: true, articleId: true, entrepotId: true },
    });
    let deletedByName = 'Inconnu';
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { prenom: true, nom: true } });
      if (user) deletedByName = `${user.prenom} ${user.nom}`;
    }
    await this.prisma.inventairePhysique.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date(), deletedById: userId ?? null, deletedByName },
    });
    const pairs = new Map<string, { articleId: string; entrepotId: string }>();
    for (const r of records) pairs.set(`${r.articleId}:${r.entrepotId}`, r);
    for (const pair of pairs.values()) await this.calculator.sync(pair.articleId, pair.entrepotId);
    return { deleted: records.length };
  }

  async findCorbeille() {
    return this.prisma.inventairePhysique.findMany({
      where: { NOT: { deletedAt: null } },
      include: { article: { select: { id: true, nom: true, reference: true, unite: true } } },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async restore(id: string) {
    const inv = await this.prisma.inventairePhysique.findUnique({ where: { id } });
    if (!inv) throw new Error('Introuvable');
    const updated = await this.prisma.inventairePhysique.update({
      where: { id },
      data: { deletedAt: null, deletedById: null, deletedByName: null },
    });
    await this.calculator.sync(inv.articleId, inv.entrepotId);
    return updated;
  }

  async supprimerDefinitivement(id: string) {
    const inv = await this.prisma.inventairePhysique.findUnique({ where: { id } });
    if (!inv) throw new Error('Introuvable');
    await this.prisma.inventairePhysique.delete({ where: { id } });
    await this.calculator.sync(inv.articleId, inv.entrepotId);
    return { deleted: true };
  }

  async viderCorbeille() {
    const items = await this.prisma.inventairePhysique.findMany({
      where: { NOT: { deletedAt: null } },
      select: { id: true, articleId: true, entrepotId: true },
    });
    if (!items.length) return { count: 0 };
    await this.prisma.inventairePhysique.deleteMany({ where: { id: { in: items.map(i => i.id) } } });
    const pairs = new Map<string, { articleId: string; entrepotId: string }>();
    for (const m of items) pairs.set(`${m.articleId}:${m.entrepotId}`, m);
    for (const p of pairs.values()) await this.calculator.sync(p.articleId, p.entrepotId);
    return { count: items.length };
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

    // Timestamp unique pour tout l'import — évite que des lignes tombent dans deux "sessions" différentes
    const importDate = new Date();

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
            date: importDate,
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
