import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Formule hybride par (articleId, entrepotId) :
 *   SI dernier inventaire existe pour cet entrepôt :
 *     stock = inventaire.quantite + SUM(ENTREE après inventaire) - SUM(SORTIE après inventaire)
 *   SINON :
 *     stock = SUM(toutes ENTREE) - SUM(toutes SORTIE)
 *
 * Un inventaire sur entrepôt A n'impacte JAMAIS entrepôt B.
 */
@Injectable()
export class StockCalculatorService {
  constructor(private prisma: PrismaService) {}

  async calcule(articleId: string, entrepotId: string): Promise<number> {
    const dernierInventaire = await this.prisma.inventairePhysique.findFirst({
      where: { articleId, entrepotId },
      orderBy: { date: 'desc' },
    });

    const qteBase = dernierInventaire?.quantite ?? 0;
    const dateFilter = dernierInventaire ? { gt: dernierInventaire.date } : undefined;

    const whereBase = { articleId, entrepotId, ...(dateFilter ? { date: dateFilter } : {}) };

    const [entrees, sorties] = await Promise.all([
      this.prisma.mouvement.aggregate({ where: { ...whereBase, type: 'ENTREE' as any }, _sum: { quantiteFournie: true } }),
      this.prisma.mouvement.aggregate({ where: { ...whereBase, type: 'SORTIE' as any }, _sum: { quantiteFournie: true } }),
    ]);

    return qteBase + (entrees._sum.quantiteFournie ?? 0) - (sorties._sum.quantiteFournie ?? 0);
  }

  /** Recalcule et persiste dans la table Stock. Retourne la nouvelle quantité. */
  async sync(articleId: string, entrepotId: string): Promise<number> {
    const quantite = await this.calcule(articleId, entrepotId);
    await this.prisma.stock.upsert({
      where: { articleId_entrepotId: { articleId, entrepotId } },
      update: { quantite },
      create: { articleId, entrepotId, quantite },
    });
    return quantite;
  }

  /** Recalcule tous les stocks d'un entrepôt (ex : après reset inventaire). */
  async syncEntrepot(entrepotId: string): Promise<void> {
    const articles = await this.prisma.article.findMany({ select: { id: true } });
    for (const a of articles) {
      await this.sync(a.id, entrepotId);
    }
  }

  /** Recalcule tous les stocks de tous les entrepôts. */
  async syncAll(): Promise<void> {
    const [articles, entrepots] = await Promise.all([
      this.prisma.article.findMany({ select: { id: true } }),
      this.prisma.entrepot.findMany({ select: { id: true } }),
    ]);
    for (const a of articles) {
      for (const e of entrepots) {
        await this.sync(a.id, e.id);
      }
    }
  }
}
