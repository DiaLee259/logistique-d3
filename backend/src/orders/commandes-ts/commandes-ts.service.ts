import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
}
