import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockCalculatorService } from '../stock/stock-calculator.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private calculator: StockCalculatorService,
  ) {}

  async resetMouvements() {
    const pairs = await this.prisma.mouvement.findMany({
      select: { articleId: true, entrepotId: true },
      distinct: ['articleId', 'entrepotId'],
    });
    const result = await this.prisma.mouvement.deleteMany({});
    for (const p of pairs) await this.calculator.sync(p.articleId, p.entrepotId);
    return { deleted: result.count };
  }

  async resetInventaires() {
    const pairs = await this.prisma.inventairePhysique.findMany({
      select: { articleId: true, entrepotId: true },
      distinct: ['articleId', 'entrepotId'],
    });
    const result = await this.prisma.inventairePhysique.deleteMany({});
    for (const p of pairs) await this.calculator.sync(p.articleId, p.entrepotId);
    return { deleted: result.count };
  }

  async resetCommandes() {
    const pairs = await this.prisma.mouvement.findMany({
      where: { commandeId: { not: null } },
      select: { articleId: true, entrepotId: true },
      distinct: ['articleId', 'entrepotId'],
    });
    await this.prisma.mouvement.deleteMany({ where: { commandeId: { not: null } } });
    await this.prisma.livraison.updateMany({ where: { commandeId: { not: null } }, data: { commandeId: null } });
    const result = await this.prisma.commande.deleteMany({});
    for (const p of pairs) await this.calculator.sync(p.articleId, p.entrepotId);
    return { deleted: result.count };
  }

  async resetLivraisons() {
    const result = await this.prisma.livraison.deleteMany({});
    return { deleted: result.count };
  }

  async resetStocks() {
    const result = await this.prisma.stock.updateMany({ data: { quantite: 0 } });
    return { updated: result.count };
  }

  async resetNotifications() {
    const result = await this.prisma.notification.deleteMany({});
    return { deleted: result.count };
  }

  async resetComplet() {
    // Ordre : mouvements → inventaires → commandes (cascade lignes) → livraisons → stocks → notifications
    await this.prisma.mouvement.deleteMany({});
    await this.prisma.inventairePhysique.deleteMany({});
    await this.prisma.livraison.deleteMany({});
    await this.prisma.commande.deleteMany({});
    await this.prisma.stock.updateMany({ data: { quantite: 0 } });
    await this.prisma.notification.deleteMany({});
    return { ok: true };
  }
}
