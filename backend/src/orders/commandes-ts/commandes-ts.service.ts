import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class CommandesTSService {
  constructor(private prisma: PrismaService) {}

  private async enrichWithLivraisons(commande: any) {
    for (const ligne of commande.lignes ?? []) {
      for (const rep of ligne.repartitions ?? []) {
        const result = await this.prisma.ligneLivraison.aggregate({
          where: {
            articleId: ligne.articleId,
            livraison: {
              entrepotId: rep.entrepotId,
              dateLivraison: { gte: commande.dateDebut, lte: commande.dateFin },
            },
          },
          _sum: { quantiteRecue: true },
        });
        rep.qteRecue = result._sum.quantiteRecue ?? 0;
      }
    }
    return commande;
  }

  async findAll() {
    const commandes = await this.prisma.commandeTS.findMany({
      where: { deletedAt: null },
      include: {
        createdBy: { select: { id: true, nom: true, prenom: true } },
        lignes: {
          include: {
            article: { select: { id: true, nom: true, reference: true, unite: true } },
            repartitions: { include: { entrepot: { select: { id: true, code: true, nom: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(commandes.map(c => this.enrichWithLivraisons(c)));
  }

  async findById(id: string) {
    const c = await this.prisma.commandeTS.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, nom: true, prenom: true } },
        lignes: {
          include: {
            article: { select: { id: true, nom: true, reference: true, unite: true } },
            repartitions: { include: { entrepot: { select: { id: true, code: true, nom: true } } } },
          },
        },
      },
    });
    if (!c) throw new NotFoundException('Commande TS introuvable');
    return this.enrichWithLivraisons(c);
  }

  async create(dto: any, userId: string) {
    const count = await this.prisma.commandeTS.count();
    const numero = `CTS-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    return this.prisma.commandeTS.create({
      data: {
        numero,
        titre: dto.titre,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        commentaire: dto.commentaire,
        createdById: userId,
        lignes: {
          create: (dto.lignes || []).map((l: any) => ({
            articleId: l.articleId,
            qteProd: l.qteProd || 0,
            qteSav: l.qteSav || 0,
            qteMalfacon: l.qteMalfacon || 0,
            repartitions: {
              create: (l.repartitions || []).map((r: any) => ({
                entrepotId: r.entrepotId,
                tauxRepartition: r.tauxRepartition || 0,
              })),
            },
          })),
        },
      },
      include: {
        lignes: {
          include: {
            article: { select: { id: true, nom: true, reference: true, unite: true } },
            repartitions: { include: { entrepot: { select: { id: true, code: true, nom: true } } } },
          },
        },
      },
    });
  }

  async update(id: string, dto: any) {
    await this.findById(id);
    return this.prisma.commandeTS.update({
      where: { id },
      data: {
        titre: dto.titre,
        dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : undefined,
        dateFin: dto.dateFin ? new Date(dto.dateFin) : undefined,
        commentaire: dto.commentaire,
        statut: dto.statut,
      },
    });
  }

  async updateRepartition(repartitionId: string, dto: any) {
    return this.prisma.repartitionCommandeTS.update({
      where: { id: repartitionId },
      data: { tauxRepartition: dto.tauxRepartition },
    });
  }

  async updateLigne(ligneId: string, dto: any) {
    return this.prisma.ligneCommandeTS.update({
      where: { id: ligneId },
      data: { qteProd: dto.qteProd, qteSav: dto.qteSav, qteMalfacon: dto.qteMalfacon },
    });
  }

  async cloturer(id: string) {
    await this.findById(id);
    return this.prisma.commandeTS.update({ where: { id }, data: { statut: 'CLOTUREE' } });
  }

  async delete(id: string, userId?: string) {
    await this.findById(id);
    let deletedByName = 'Inconnu';
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { prenom: true, nom: true } });
      if (user) deletedByName = `${user.prenom} ${user.nom}`;
    }
    return this.prisma.commandeTS.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId, deletedByName },
    });
  }

  async restore(id: string) {
    return this.prisma.commandeTS.update({
      where: { id },
      data: { deletedAt: null, deletedById: null, deletedByName: null },
    });
  }

  async supprimerDefinitivement(id: string) {
    // LigneCommandeTS et RepartitionCommandeTS ont onDelete: Cascade
    return this.prisma.commandeTS.delete({ where: { id } });
  }

  async viderCorbeille() {
    return this.prisma.commandeTS.deleteMany({ where: { NOT: { deletedAt: null } } });
  }

  async findCorbeille() {
    return this.prisma.commandeTS.findMany({
      where: { NOT: { deletedAt: null } },
      select: {
        id: true, numero: true, titre: true, dateDebut: true, dateFin: true,
        deletedAt: true, deletedByName: true,
      },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async importCommandesTS(buffer: Buffer, userId?: string) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    let created = 0;
    let skipped = 0;
    // Group rows by refGroupe
    const groups = new Map<string, any[]>();
    ws.eachRow((row, idx) => {
      if (idx === 1) return;
      const refGroupe = String(row.getCell(1).value ?? '').trim();
      if (!refGroupe) return;
      if (!groups.has(refGroupe)) groups.set(refGroupe, []);
      groups.get(refGroupe)!.push(row);
    });

    for (const [, rows] of groups) {
      const firstRow = rows[0];
      const titre = String(firstRow.getCell(2).value ?? '').trim();
      const dateDeb = String(firstRow.getCell(3).value ?? '').trim();
      const dateFin = String(firstRow.getCell(4).value ?? '').trim();
      if (!titre || !dateDeb || !dateFin) { skipped++; continue; }
      const commentaire = String(firstRow.getCell(5).value ?? '').trim() || undefined;

      // Group rows within the group by refArticle
      const articleMap = new Map<string, { qteProd: number; qteSav: number; qteMalfacon: number; repartitions: { entrepotId: string; tauxRepartition: number }[] }>();
      for (const row of rows) {
        const refArticle = String(row.getCell(6).value ?? '').trim();
        if (!refArticle) continue;
        const qteProd = parseInt(String(row.getCell(7).value ?? '0')) || 0;
        const qteSav = parseInt(String(row.getCell(8).value ?? '0')) || 0;
        const qteMalfacon = parseInt(String(row.getCell(9).value ?? '0')) || 0;
        const codeEntrepot = String(row.getCell(10).value ?? '').trim();
        const tauxRepartition = parseFloat(String(row.getCell(11).value ?? '0')) || 0;

        if (!articleMap.has(refArticle)) {
          articleMap.set(refArticle, { qteProd, qteSav, qteMalfacon, repartitions: [] });
        }
        if (codeEntrepot) {
          const entrepot = await this.prisma.entrepot.findFirst({ where: { code: codeEntrepot } });
          if (entrepot) {
            articleMap.get(refArticle)!.repartitions.push({ entrepotId: entrepot.id, tauxRepartition });
          }
        }
      }

      const lignes: any[] = [];
      for (const [refArticle, data] of articleMap) {
        const article = await this.prisma.article.findFirst({ where: { reference: refArticle } });
        if (!article) continue;
        lignes.push({ articleId: article.id, ...data });
      }

      if (lignes.length === 0) { skipped++; continue; }
      try {
        await this.create({ titre, dateDebut: dateDeb, dateFin, commentaire, lignes }, userId ?? '');
        created++;
      } catch {
        skipped++;
      }
    }
    return { created, skipped, total: created + skipped };
  }
}
