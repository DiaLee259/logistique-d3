import { Injectable } from '@nestjs/common';
import { TypeMouvement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function parseMois(mois?: string): { dateDebut?: string; dateFin?: string } {
  if (!mois) return {};
  const [year, month] = mois.split('-').map(Number);
  const debut = new Date(year, month - 1, 1);
  const fin = new Date(year, month, 0);
  return {
    dateDebut: debut.toISOString().split('T')[0],
    dateFin: fin.toISOString().split('T')[0],
  };
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getKpis(entrepotId?: string, dateDebut?: string, dateFin?: string, mois?: string, articleId?: string, userEntrepots: string[] = []) {
    const parsed = mois ? parseMois(mois) : {};
    const debut = parsed.dateDebut ?? dateDebut;
    const fin = parsed.dateFin ?? dateFin;

    const dateFilter: any = {};
    if (debut) dateFilter.gte = new Date(debut);
    if (fin) dateFilter.lte = new Date(fin + 'T23:59:59');

    const mouvFilter: any = {};
    if (entrepotId) mouvFilter.entrepotId = entrepotId;
    else if (userEntrepots.length) mouvFilter.entrepotId = { in: userEntrepots };
    if (articleId) mouvFilter.articleId = articleId;
    if (debut || fin) mouvFilter.date = dateFilter;

    const cmdDateFilter: any = { deletedAt: null };
    if (entrepotId) cmdDateFilter.entrepotSource = entrepotId;
    else if (userEntrepots.length) cmdDateFilter.entrepotSource = { in: userEntrepots };
    if (debut || fin) {
      cmdDateFilter.dateReception = {};
      if (debut) cmdDateFilter.dateReception.gte = new Date(debut);
      if (fin) cmdDateFilter.dateReception.lte = new Date(fin + 'T23:59:59');
    }

    const [
      totalEntrees,
      totalSorties,
      articlesActifs,
      commandesEnAttente,
      commandesAttLog2,
      commandesValidees,
      commandesExpediees,
      commandesLivrees,
      commandesTraitees,
      commandesTotal,
      stocksEnAlerte,
    ] = await Promise.all([
      this.prisma.mouvement.aggregate({
        where: { ...mouvFilter, type: TypeMouvement.ENTREE },
        _sum: { quantiteFournie: true },
      }),
      this.prisma.mouvement.aggregate({
        where: { ...mouvFilter, type: TypeMouvement.SORTIE },
        _sum: { quantiteFournie: true },
      }),
      this.prisma.article.count({ where: { actif: true } }),
      this.prisma.commande.count({ where: { ...cmdDateFilter, statut: 'EN_ATTENTE' } }),
      this.prisma.commande.count({ where: { ...cmdDateFilter, statut: 'EN_ATTENTE_LOG2' } }),
      this.prisma.commande.count({ where: { ...cmdDateFilter, statut: 'VALIDEE' } }),
      this.prisma.commande.count({ where: { ...cmdDateFilter, statut: 'EXPEDIEE' } }),
      this.prisma.commande.count({ where: { ...cmdDateFilter, statut: 'LIVREE' } }),
      this.prisma.commande.count({ where: { ...cmdDateFilter, statut: { in: ['EXPEDIEE', 'LIVREE'] } } }),
      this.prisma.commande.count({ where: { ...cmdDateFilter, statut: { not: 'ANNULEE' } } }),
      this.prisma.stock.count({ where: { quantite: { lte: 10 } } }),
    ]);

    const entrees = totalEntrees._sum.quantiteFournie ?? 0;
    const sorties = totalSorties._sum.quantiteFournie ?? 0;

    return {
      totalEntrees: entrees,
      totalSorties: sorties,
      soldeNet: entrees - sorties,
      articlesActifs,
      commandesEnAttente: commandesEnAttente + commandesAttLog2,
      commandesAttLog2,
      commandesValidees,
      commandesExpediees,
      commandesLivrees,
      commandesTraitees,
      commandesTotal,
      stocksEnAlerte,
      tauxService: commandesTotal > 0 ? Math.round((commandesTraitees / commandesTotal) * 100) : 0,
    };
  }

  async getEvolutionStock(entrepotId?: string, dateDebut?: string, dateFin?: string, mois?: string, articleId?: string, userEntrepots: string[] = []) {
    const parsed = mois ? parseMois(mois) : {};
    const debut = parsed.dateDebut ?? dateDebut;
    const fin = parsed.dateFin ?? dateFin;

    const where: any = {};
    if (entrepotId) where.entrepotId = entrepotId;
    else if (userEntrepots.length) where.entrepotId = { in: userEntrepots };
    if (articleId) where.articleId = articleId;
    if (debut || fin) {
      where.date = {};
      if (debut) where.date.gte = new Date(debut);
      if (fin) where.date.lte = new Date(fin + 'T23:59:59');
    }

    const mouvements = await this.prisma.mouvement.findMany({
      where,
      select: { date: true, type: true, quantiteFournie: true },
      orderBy: { date: 'asc' },
    });

    const byDay: Record<string, { entrees: number; sorties: number }> = {};
    for (const m of mouvements) {
      const day = m.date.toISOString().split('T')[0];
      if (!byDay[day]) byDay[day] = { entrees: 0, sorties: 0 };
      if (m.type === TypeMouvement.ENTREE) byDay[day].entrees += m.quantiteFournie;
      else byDay[day].sorties += m.quantiteFournie;
    }

    return Object.entries(byDay).map(([date, v]) => ({ date, ...v }));
  }

  async getVolumeParDepartement(entrepotId?: string, mois?: string, userEntrepots: string[] = []) {
    const parsed = mois ? parseMois(mois) : {};
    const where: any = { type: TypeMouvement.SORTIE };
    if (entrepotId) where.entrepotId = entrepotId;
    else if (userEntrepots.length) where.entrepotId = { in: userEntrepots };
    if (parsed.dateDebut || parsed.dateFin) {
      where.date = {};
      if (parsed.dateDebut) where.date.gte = new Date(parsed.dateDebut);
      if (parsed.dateFin) where.date.lte = new Date(parsed.dateFin + 'T23:59:59');
    }

    const data = await this.prisma.mouvement.groupBy({
      by: ['departement'],
      where,
      _sum: { quantiteFournie: true },
      orderBy: { _sum: { quantiteFournie: 'desc' } },
    });

    return data.map(d => ({
      departement: d.departement || 'Non défini',
      volume: d._sum.quantiteFournie ?? 0,
    }));
  }

  async getVolumeParDemandeur(mois?: string, userEntrepots: string[] = [], entrepotId?: string) {
    const parsed = mois ? parseMois(mois) : {};
    const where: any = { statut: { not: 'ANNULEE' }, deletedAt: null };
    if (entrepotId) where.entrepotSource = entrepotId;
    else if (userEntrepots.length) where.entrepotSource = { in: userEntrepots };
    if (parsed.dateDebut || parsed.dateFin) {
      where.dateReception = {};
      if (parsed.dateDebut) where.dateReception.gte = new Date(parsed.dateDebut);
      if (parsed.dateFin) where.dateReception.lte = new Date(parsed.dateFin + 'T23:59:59');
    }

    const data = await this.prisma.commande.groupBy({
      by: ['demandeur'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    return data.map(d => ({
      demandeur: d.demandeur || 'Non identifié',
      commandes: d._count.id,
    }));
  }

  async getDelaisMoyens(userEntrepots: string[] = [], entrepotId?: string) {
    const where: any = {
      deletedAt: null,
      statut: { notIn: ['ANNULEE', 'EN_ATTENTE'] },
    };
    if (entrepotId) where.entrepotSource = entrepotId;
    else if (userEntrepots.length) where.entrepotSource = { in: userEntrepots };

    const commandes = await this.prisma.commande.findMany({
      where,
      select: {
        dateReception: true,
        dateTraitement: true,
        dateExpedition: true,
        dateLivraison: true,
        statut: true,
      },
    });

    let sumRTT = 0, cntRTT = 0;
    let sumTTE = 0, cntTTE = 0;
    let sumETL = 0, cntETL = 0;

    for (const c of commandes) {
      if (c.dateReception && c.dateTraitement) {
        sumRTT += c.dateTraitement.getTime() - c.dateReception.getTime();
        cntRTT++;
      }
      if (c.dateTraitement && c.dateExpedition) {
        sumTTE += c.dateExpedition.getTime() - c.dateTraitement.getTime();
        cntTTE++;
      }
      if (c.dateExpedition && c.dateLivraison) {
        sumETL += c.dateLivraison.getTime() - c.dateExpedition.getTime();
        cntETL++;
      }
    }

    const toDays = (ms: number) => Math.round(ms / (1000 * 60 * 60 * 24) * 10) / 10;

    return {
      receptionToTraitement: cntRTT > 0 ? toDays(sumRTT / cntRTT) : null,
      traitementToExpedition: cntTTE > 0 ? toDays(sumTTE / cntTTE) : null,
      expeditionToLivraison: cntETL > 0 ? toDays(sumETL / cntETL) : null,
      totalCommandesAnalysees: commandes.length,
      nbTraitees: cntTTE,
      nbLivrees: cntETL,
    };
  }

  async getTopArticles(limit = 5, userEntrepots: string[] = [], entrepotId?: string) {
    const where: any = { type: TypeMouvement.SORTIE };
    if (entrepotId) where.entrepotId = entrepotId;
    else if (userEntrepots.length) where.entrepotId = { in: userEntrepots };

    const data = await this.prisma.mouvement.groupBy({
      by: ['articleId'],
      where,
      _sum: { quantiteFournie: true },
      orderBy: { _sum: { quantiteFournie: 'desc' } },
      take: limit,
    });

    const articles = await this.prisma.article.findMany({
      where: { id: { in: data.map(d => d.articleId) } },
      select: { id: true, nom: true, reference: true },
    });

    return data.map(d => ({
      ...articles.find(a => a.id === d.articleId),
      volume: d._sum.quantiteFournie ?? 0,
    }));
  }

  async getResumeCommandes(userEntrepots: string[] = [], entrepotId?: string) {
    const where: any = { deletedAt: null };
    if (entrepotId) where.entrepotSource = entrepotId;
    else if (userEntrepots.length) where.entrepotSource = { in: userEntrepots };

    const par_statut = await this.prisma.commande.groupBy({
      by: ['statut'],
      where,
      _count: { id: true },
    });
    return par_statut.map(s => ({ statut: s.statut, count: s._count.id }));
  }
}
