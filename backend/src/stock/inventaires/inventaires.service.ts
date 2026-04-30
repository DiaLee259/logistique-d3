import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventairesService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: { entrepotId?: string; articleId?: string; mois?: string }) {
    const where: any = {};
    if (filters.entrepotId) where.entrepotId = filters.entrepotId;
    if (filters.articleId) where.articleId = filters.articleId;
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

  // Vue consolidée par entrepôt : tous les articles actifs + stock (éventuellement 0) + dernier inventaire
  async getEtatParEntrepot(entrepotId: string) {
    // On prend TOUS les articles actifs (pas seulement ceux avec du stock)
    const articles = await this.prisma.article.findMany({
      where: { actif: true },
      select: { id: true, nom: true, reference: true, unite: true, seuilAlerte: true },
      orderBy: { nom: 'asc' },
    });

    const result = await Promise.all(articles.map(async (article) => {
      const stock = await this.prisma.stock.findUnique({
        where: { articleId_entrepotId: { articleId: article.id, entrepotId } },
      });

      const dernierInventaire = await this.prisma.inventairePhysique.findFirst({
        where: { entrepotId, articleId: article.id },
        orderBy: { date: 'desc' },
      });

      const stockTheorique = stock?.quantite ?? 0;

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
  async getAlertes() {
    const entrepots = await this.prisma.entrepot.findMany({ where: { actif: true } });
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
    return created;
  }
}
