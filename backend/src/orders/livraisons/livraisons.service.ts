import { Injectable, NotFoundException } from '@nestjs/common';
import { StatutLivraison, TypeMouvement } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MouvementsService } from '../../stock/mouvements/mouvements.service';
import { StockCalculatorService } from '../../stock/stock-calculator.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class LivraisonsService {
  constructor(
    private prisma: PrismaService,
    private mouvementsService: MouvementsService,
    private calculator: StockCalculatorService,
  ) {}

  async findAll(filters: any) {
    const where: any = { deletedAt: null };
    if (filters.statut) where.statut = filters.statut;
    if (filters.entrepotId) where.entrepotId = filters.entrepotId;
    if (filters.userEntrepots?.length) where.entrepotId = { in: filters.userEntrepots };
    if (filters.mois) {
      const [y, m] = filters.mois.split('-').map(Number);
      where.dateLivraison = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    }

    const [data, total] = await Promise.all([
      this.prisma.livraison.findMany({
        where,
        include: {
          lignes: { include: { article: true } },
          entrepot: true,
        },
        orderBy: { dateLivraison: 'desc' },
      }),
      this.prisma.livraison.count({ where }),
    ]);
    return { data, total };
  }

  async findById(id: string) {
    const l = await this.prisma.livraison.findUnique({
      where: { id },
      include: { lignes: { include: { article: true } }, entrepot: true },
    });
    if (!l) throw new NotFoundException('Livraison introuvable');
    return l;
  }

  async create(data: {
    fournisseur: string;
    entrepotId: string;
    lignes: { articleId: string; quantiteCommandee: number; quantiteRecue: number }[];
    bonLivraisonUrl?: string;
    bonCommandeUrl?: string;
    commentaire?: string;
    commandeId?: string;
  }, userId?: string) {
    // On base le numéro sur le MAX existant (et non sur count) pour éviter
    // les conflits quand des livraisons sont supprimées définitivement via la corbeille.
    const year = new Date().getFullYear();
    const lastLivraison = await this.prisma.livraison.findFirst({
      where: { numero: { startsWith: `LIV-${year}-` } },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    const lastNum = lastLivraison
      ? parseInt(lastLivraison.numero.split('-')[2] ?? '0', 10)
      : 0;
    const numero = `LIV-${year}-${String(lastNum + 1).padStart(4, '0')}`;

    const livraison = await this.prisma.livraison.create({
      data: {
        numero,
        fournisseur: data.fournisseur,
        entrepotId: data.entrepotId,
        statut: StatutLivraison.LIVREE,
        bonLivraisonUrl: data.bonLivraisonUrl,
        bonCommandeUrl: data.bonCommandeUrl,
        commentaire: data.commentaire,
        commandeId: data.commandeId,
        lignes: {
          create: data.lignes.map(l => ({
            articleId: l.articleId,
            quantiteCommandee: l.quantiteCommandee,
            quantiteRecue: l.quantiteRecue,
          })),
        },
      },
      include: { lignes: { include: { article: true } }, entrepot: true },
    });

    // Créer les mouvements d'entrée en stock, liés à cette livraison
    for (const ligne of data.lignes) {
      if (ligne.quantiteRecue > 0) {
        await this.mouvementsService.create({
          articleId: ligne.articleId,
          entrepotId: data.entrepotId,
          type: TypeMouvement.ENTREE,
          quantiteDemandee: ligne.quantiteCommandee,
          quantiteFournie: ligne.quantiteRecue,
          sourceDestination: data.fournisseur,
          commentaire: `Livraison ${numero}`,
          livraisonId: livraison.id,
        } as any, userId);
      }
    }

    return livraison;
  }

  async updateStatut(id: string, statut: StatutLivraison, urls?: { bonLivraisonUrl?: string; bonCommandeUrl?: string }) {
    await this.findById(id);
    return this.prisma.livraison.update({
      where: { id },
      data: { statut, ...urls },
    });
  }

  async delete(id: string, userId?: string) {
    await this.findById(id);
    let deletedByName = 'Inconnu';
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { prenom: true, nom: true } });
      if (user) deletedByName = `${user.prenom} ${user.nom}`;
    }
    return this.prisma.livraison.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId, deletedByName },
    });
  }

  async restore(id: string) {
    return this.prisma.livraison.update({
      where: { id },
      data: { deletedAt: null, deletedById: null, deletedByName: null },
    });
  }

  async supprimerDefinitivement(id: string) {
    // Récupérer les mouvements liés avant suppression pour recalculer le stock
    const mouvements = await this.prisma.mouvement.findMany({
      where: { livraisonId: id },
      select: { articleId: true, entrepotId: true },
    });

    // Supprimer les mouvements liés (le ON DELETE SET NULL est ignoré ici, on les supprime vraiment)
    await this.prisma.mouvement.deleteMany({ where: { livraisonId: id } });

    // LigneLivraison a onDelete: Cascade → supprimées automatiquement
    const result = await this.prisma.livraison.delete({ where: { id } });

    // Recalculer le stock pour chaque article/entrepôt impacté
    const pairs = new Map<string, { articleId: string; entrepotId: string }>();
    for (const m of mouvements) pairs.set(`${m.articleId}:${m.entrepotId}`, m);
    for (const p of pairs.values()) await this.calculator.sync(p.articleId, p.entrepotId);

    return result;
  }

  async viderCorbeille() {
    const livraisons = await this.prisma.livraison.findMany({
      where: { NOT: { deletedAt: null } },
      select: { id: true },
    });
    if (!livraisons.length) return { count: 0 };
    const ids = livraisons.map(l => l.id);

    // Récupérer les mouvements liés pour recalcul
    const mouvements = await this.prisma.mouvement.findMany({
      where: { livraisonId: { in: ids } },
      select: { articleId: true, entrepotId: true },
    });

    await this.prisma.mouvement.deleteMany({ where: { livraisonId: { in: ids } } });
    const result = await this.prisma.livraison.deleteMany({ where: { id: { in: ids } } });

    const pairs = new Map<string, { articleId: string; entrepotId: string }>();
    for (const m of mouvements) pairs.set(`${m.articleId}:${m.entrepotId}`, m);
    for (const p of pairs.values()) await this.calculator.sync(p.articleId, p.entrepotId);

    return result;
  }

  async findCorbeille() {
    return this.prisma.livraison.findMany({
      where: { NOT: { deletedAt: null } },
      select: {
        id: true, numero: true, fournisseur: true, dateLivraison: true,
        deletedAt: true, deletedByName: true,
        lignes: { select: { quantiteRecue: true, article: { select: { nom: true } } } },
      },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async importLivraisons(buffer: Buffer, userId?: string) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    if (!ws) return { created: 0, skipped: 0, errors: ['Fichier Excel vide ou invalide'], total: 0 };

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Regrouper les lignes par Ref groupe (col 1)
    const groups = new Map<string, any[]>();
    let autoIdx = 0;
    ws.eachRow((row, idx) => {
      if (idx === 1) return;
      const key = String(row.getCell(1).value ?? '').trim() || `__auto_${autoIdx++}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    });

    for (const [groupKey, rows] of groups) {
      const firstRow = rows[0];
      const numeroCommande  = String(firstRow.getCell(2).value ?? '').trim() || undefined;
      const codeEntrepot    = String(firstRow.getCell(3).value ?? '').trim();
      const fournisseur     = String(firstRow.getCell(4).value ?? '').trim() || 'Inconnu';
      // Col 5 = N° suivi (non stocké), Col 6 = date prévue

      if (!codeEntrepot) {
        errors.push(`Groupe "${groupKey}" : Code entrepôt manquant`); skipped++; continue;
      }
      const entrepot = await this.prisma.entrepot.findFirst({ where: { code: codeEntrepot } });
      if (!entrepot) {
        errors.push(`Entrepôt introuvable : "${codeEntrepot}" (groupe "${groupKey}")`); skipped++; continue;
      }

      let commandeId: string | undefined;
      if (numeroCommande) {
        const commande = await this.prisma.commande.findFirst({ where: { numero: numeroCommande } });
        if (!commande) errors.push(`Commande "${numeroCommande}" introuvable — livraison créée sans lien`);
        else commandeId = commande.id;
      }

      const lignes: { articleId: string; quantiteCommandee: number; quantiteRecue: number }[] = [];
      for (const row of rows) {
        const refArticle   = String(row.getCell(7).value ?? '').trim();
        const quantiteRecue = Math.max(0, parseInt(String(row.getCell(8).value ?? '0')) || 0);
        if (!refArticle) continue;
        const article = await this.prisma.article.findFirst({ where: { reference: refArticle } });
        if (!article) {
          errors.push(`Article introuvable : "${refArticle}"`); continue;
        }
        lignes.push({ articleId: article.id, quantiteCommandee: quantiteRecue, quantiteRecue });
      }

      if (lignes.length === 0) {
        errors.push(`Groupe "${groupKey}" : aucun article valide`); skipped++; continue;
      }
      try {
        await this.create({ fournisseur, entrepotId: entrepot.id, lignes, commandeId }, userId);
        created++;
      } catch (err: any) {
        errors.push(`Erreur création livraison groupe "${groupKey}" : ${err?.message ?? String(err)}`);
        skipped++;
      }
    }
    return { created, skipped, errors, total: created + skipped };
  }
}
