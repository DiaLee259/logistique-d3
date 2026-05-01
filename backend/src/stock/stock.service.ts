import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

  async getStockComplet(entrepotId?: string, userEntrepots?: string[]) {
    const where: any = {};
    if (entrepotId) where.entrepotId = entrepotId;
    else if (userEntrepots?.length) where.entrepotId = { in: userEntrepots };
    return this.prisma.stock.findMany({
      where: Object.keys(where).length ? where : undefined,
      include: {
        article: true,
        entrepot: { select: { id: true, code: true, nom: true } },
      },
      orderBy: { article: { nom: 'asc' } },
    });
  }

  async getArticlesEnAlerte() {
    const stocks = await this.prisma.stock.findMany({
      include: { article: true, entrepot: true },
    });
    return stocks.filter(s => s.quantite <= s.article.seuilAlerte);
  }

  async getInventaireEcarts() {
    const inventaires = await this.prisma.inventairePhysique.findMany({
      include: { article: true },
      orderBy: { date: 'desc' },
    });

    const stocks = await this.prisma.stock.findMany({
      include: { article: true, entrepot: true },
    });

    return stocks.map(s => {
      const lastInventaire = inventaires.find(i => i.articleId === s.articleId);
      const ecart = lastInventaire ? lastInventaire.quantite - s.quantite : null;
      return { ...s, inventairePhysique: lastInventaire?.quantite, ecart };
    });
  }

  async saisirInventairePhysique(data: {
    articleId: string;
    entrepotId: string;
    quantite: number;
    userId?: string;
    commentaire?: string;
  }) {
    return this.prisma.inventairePhysique.create({ data });
  }
}
