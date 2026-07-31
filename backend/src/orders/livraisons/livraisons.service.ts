import { Injectable, NotFoundException } from '@nestjs/common';
import { StatutLivraison, TypeMouvement } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MouvementsService } from '../../stock/mouvements/mouvements.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class LivraisonsService {
  constructor(
    private prisma: PrismaService,
    private mouvementsService: MouvementsService,
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
    const count = await this.prisma.livraison.count();
    const numero = `LIV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

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

    // Créer les mouvements d'entrée en stock
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
        }, userId);
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
    // LigneLivraison a onDelete: Cascade → supprimées automatiquement
    return this.prisma.livraison.delete({ where: { id } });
  }

  async viderCorbeille() {
    return this.prisma.livraison.deleteMany({ where: { NOT: { deletedAt: null } } });
  }

  async getRapportLivraisons(params: { dateDebut: string; dateFin: string; articleId?: string; entrepotId?: string; format?: string }): Promise<Buffer | any[]> {
    const dateDebutSOD = new Date(params.dateDebut);
    dateDebutSOD.setHours(0, 0, 0, 0);
    const dateFinEOD = new Date(params.dateFin);
    dateFinEOD.setHours(23, 59, 59, 999);

    const livraisons = await this.prisma.livraison.findMany({
      where: {
        deletedAt: null,
        dateLivraison: { gte: dateDebutSOD, lte: dateFinEOD },
        ...(params.entrepotId ? { entrepotId: params.entrepotId } : {}),
      },
      include: {
        lignes: {
          include: { article: true },
          ...(params.articleId ? { where: { articleId: params.articleId } } : {}),
        },
        entrepot: true,
      },
      orderBy: { dateLivraison: 'asc' },
    });

    const rows: { date: string; numero: string; entrepot: string; fournisseur: string; article: string; reference: string; unite: string; quantiteRecue: number }[] = [];
    for (const liv of livraisons) {
      for (const ligne of liv.lignes) {
        if (ligne.quantiteRecue > 0) {
          rows.push({
            date: liv.dateLivraison.toISOString().slice(0, 10),
            numero: liv.numero,
            entrepot: liv.entrepot.code,
            fournisseur: liv.fournisseur,
            article: ligne.article.nom,
            reference: ligne.article.reference,
            unite: ligne.article.unite,
            quantiteRecue: ligne.quantiteRecue,
          });
        }
      }
    }

    if (params.format === 'json') return rows;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Rapport livraisons');
    ws.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'N° Livraison', key: 'numero', width: 18 },
      { header: 'Entrepôt', key: 'entrepot', width: 12 },
      { header: 'Fournisseur', key: 'fournisseur', width: 25 },
      { header: 'Article', key: 'article', width: 40 },
      { header: 'Référence', key: 'reference', width: 18 },
      { header: 'Unité', key: 'unite', width: 8 },
      { header: 'Qté reçue', key: 'quantiteRecue', width: 12 },
    ];
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6E' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    headerRow.height = 40;
    let rowNum = 1;
    for (const row of rows) {
      rowNum++;
      const r = ws.addRow(row);
      r.alignment = { vertical: 'middle' };
      if (rowNum % 2 === 0) r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FC' } };
    }
    ws.eachRow(r => r.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D7E4' } }, bottom: { style: 'thin', color: { argb: 'FFD0D7E4' } },
        left: { style: 'thin', color: { argb: 'FFD0D7E4' } }, right: { style: 'thin', color: { argb: 'FFD0D7E4' } },
      };
    }));
    return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
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
