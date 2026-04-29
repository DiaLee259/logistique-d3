import { Injectable, NotFoundException } from '@nestjs/common';
import { StatutLivraison, TypeMouvement } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MouvementsService } from '../../stock/mouvements/mouvements.service';

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
}
