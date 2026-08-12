import { Injectable } from '@nestjs/common';
import { TypeMouvement } from '@prisma/client';
import * as ExcelJS from 'exceljs';
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

function applyDateRange(where: any, field: string, debut?: string, fin?: string) {
  if (!debut && !fin) return;
  where[field] = {};
  if (debut) where[field].gte = new Date(debut);
  if (fin) where[field].lte = new Date(fin + 'T23:59:59');
}

// Champs communs à Commande ET Mouvement (entrepôt, département, manager)
function applyCommonFilters(where: any, filters: Record<string, string>, userEntrepots: string[], entrepotField: string) {
  if (filters.entrepotId) where[entrepotField] = filters.entrepotId;
  else if (userEntrepots.length) where[entrepotField] = { in: userEntrepots };
  if (filters.departement) where.departement = { contains: filters.departement, mode: 'insensitive' };
  if (filters.manager) where.manager = { equals: filters.manager, mode: 'insensitive' };
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getKpis(filters: Record<string, string> = {}, userEntrepots: string[] = []) {
    const parsed = filters.mois ? parseMois(filters.mois) : {};
    const debut = parsed.dateDebut ?? filters.dateDebut;
    const fin = parsed.dateFin ?? filters.dateFin;

    const mouvFilter: any = {};
    applyCommonFilters(mouvFilter, filters, userEntrepots, 'entrepotId');
    if (filters.articleId) mouvFilter.articleId = filters.articleId;
    applyDateRange(mouvFilter, 'date', debut, fin);

    const cmdDateFilter: any = { deletedAt: null };
    applyCommonFilters(cmdDateFilter, filters, userEntrepots, 'entrepotSource');
    applyDateRange(cmdDateFilter, 'dateReception', debut, fin);
    applyDateRange(cmdDateFilter, 'dateTraitement', filters.dateTraitementDebut, filters.dateTraitementFin);
    applyDateRange(cmdDateFilter, 'dateLivraison', filters.dateLivraisonDebut, filters.dateLivraisonFin);

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

  async getEvolutionStock(filters: Record<string, string> = {}, userEntrepots: string[] = []) {
    const parsed = filters.mois ? parseMois(filters.mois) : {};
    const debut = parsed.dateDebut ?? filters.dateDebut;
    const fin = parsed.dateFin ?? filters.dateFin;

    const where: any = {};
    applyCommonFilters(where, filters, userEntrepots, 'entrepotId');
    if (filters.articleId) where.articleId = filters.articleId;
    applyDateRange(where, 'date', debut, fin);

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

  async getVolumeParDepartement(filters: Record<string, string> = {}, userEntrepots: string[] = []) {
    const parsed = filters.mois ? parseMois(filters.mois) : {};
    const where: any = { type: TypeMouvement.SORTIE };
    applyCommonFilters(where, filters, userEntrepots, 'entrepotId');
    applyDateRange(where, 'date', parsed.dateDebut, parsed.dateFin);

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

  async getVolumeParDemandeur(filters: Record<string, string> = {}, userEntrepots: string[] = []) {
    const parsed = filters.mois ? parseMois(filters.mois) : {};
    const where: any = { statut: { not: 'ANNULEE' }, deletedAt: null };
    applyCommonFilters(where, filters, userEntrepots, 'entrepotSource');
    applyDateRange(where, 'dateReception', parsed.dateDebut, parsed.dateFin);
    applyDateRange(where, 'dateTraitement', filters.dateTraitementDebut, filters.dateTraitementFin);
    applyDateRange(where, 'dateLivraison', filters.dateLivraisonDebut, filters.dateLivraisonFin);

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

  async getDelaisMoyens(filters: Record<string, string> = {}, userEntrepots: string[] = []) {
    const where: any = {
      deletedAt: null,
      statut: { notIn: ['ANNULEE', 'EN_ATTENTE'] },
    };
    applyCommonFilters(where, filters, userEntrepots, 'entrepotSource');
    applyDateRange(where, 'dateReception', filters.dateDebut, filters.dateFin);
    applyDateRange(where, 'dateTraitement', filters.dateTraitementDebut, filters.dateTraitementFin);
    applyDateRange(where, 'dateLivraison', filters.dateLivraisonDebut, filters.dateLivraisonFin);

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

  async getTopArticles(filters: Record<string, string> = {}, userEntrepots: string[] = []) {
    const limit = filters.limit ? parseInt(filters.limit) : 5;
    const where: any = { type: TypeMouvement.SORTIE };
    applyCommonFilters(where, filters, userEntrepots, 'entrepotId');

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

  async getResumeCommandes(filters: Record<string, string> = {}, userEntrepots: string[] = []) {
    const where: any = { deletedAt: null };
    applyCommonFilters(where, filters, userEntrepots, 'entrepotSource');
    applyDateRange(where, 'dateReception', filters.dateDebut, filters.dateFin);
    applyDateRange(where, 'dateTraitement', filters.dateTraitementDebut, filters.dateTraitementFin);
    applyDateRange(where, 'dateLivraison', filters.dateLivraisonDebut, filters.dateLivraisonFin);

    const par_statut = await this.prisma.commande.groupBy({
      by: ['statut'],
      where,
      _count: { id: true },
    });
    return par_statut.map(s => ({ statut: s.statut, count: s._count.id }));
  }

  /**
   * Vue de pilotage : état du flux de commandes ventilé par dimension
   * (département, demandeur, société, manager).
   *
   * On récupère les commandes du périmètre en une seule requête plutôt qu'un
   * groupBy par statut : il faut aussi les délais moyens et l'ancienneté du
   * backlog, qui ne s'obtiennent pas par agrégat SQL simple. Le volume de
   * commandes reste modeste (quelques milliers), donc l'agrégation en mémoire
   * est adaptée et évite une dizaine d'allers-retours en base.
   */
  async getPilotage(filters: Record<string, string> = {}, userEntrepots: string[] = []) {
    const parsed = filters.mois ? parseMois(filters.mois) : {};
    const debut = parsed.dateDebut ?? filters.dateDebut;
    const fin = parsed.dateFin ?? filters.dateFin;

    const where: any = { deletedAt: null };
    applyCommonFilters(where, filters, userEntrepots, 'entrepotSource');
    applyDateRange(where, 'dateReception', debut, fin);
    applyDateRange(where, 'dateTraitement', filters.dateTraitementDebut, filters.dateTraitementFin);
    applyDateRange(where, 'dateLivraison', filters.dateLivraisonDebut, filters.dateLivraisonFin);

    const commandes = await this.prisma.commande.findMany({
      where,
      select: {
        statut: true,
        departement: true,
        demandeur: true,
        societe: true,
        manager: true,
        dateReception: true,
        dateTraitement: true,
        dateExpedition: true,
        dateLivraison: true,
        nombreGrilles: true,
      },
    });

    const maintenant = Date.now();
    const EN_COURS = ['EN_VALIDATION', 'VALIDEE', 'EN_ATTENTE_LOG2', 'EXPEDIEE'];

    const ventile = (cle: (c: (typeof commandes)[number]) => string) => {
      const groupes = new Map<string, typeof commandes>();
      for (const c of commandes) {
        const k = cle(c) || 'Non défini';
        if (!groupes.has(k)) groupes.set(k, []);
        groupes.get(k)!.push(c);
      }

      const moyenne = (valeurs: number[]) =>
        valeurs.length ? Math.round((valeurs.reduce((s, v) => s + v, 0) / valeurs.length) * 10) / 10 : null;
      const ecart = (a?: Date | null, b?: Date | null) =>
        a && b ? (b.getTime() - a.getTime()) / 86400000 : null;

      const lignes = [...groupes.entries()].map(([libelle, cs]) => {
        const compte = (s: string) => cs.filter(c => c.statut === s).length;
        const livrees = compte('LIVREE');
        const annulees = compte('ANNULEE');
        const refusees = compte('REFUSEE');
        const enAttente = compte('EN_ATTENTE');
        const enCours = cs.filter(c => EN_COURS.includes(c.statut)).length;

        // Le taux de livraison exclut annulées et refusées : elles n'ont jamais
        // eu vocation à être livrées, les compter fausserait la performance.
        const base = cs.length - annulees - refusees;

        // Ancienneté du plus vieux dossier encore ouvert : signale un blocage
        // qu'une moyenne lisserait.
        const ouvertes = cs.filter(c => c.statut === 'EN_ATTENTE' || EN_COURS.includes(c.statut));
        const attenteMax = ouvertes.length
          ? Math.round(Math.max(...ouvertes.map(c => (maintenant - c.dateReception.getTime()) / 86400000)) * 10) / 10
          : null;

        return {
          libelle,
          total: cs.length,
          enAttente,
          enCours,
          livrees,
          refusees,
          annulees,
          grilles: cs.reduce((s, c) => s + (c.nombreGrilles ?? 0), 0),
          tauxLivraison: base > 0 ? Math.round((livrees / base) * 100) : null,
          delaiTraitement: moyenne(cs.map(c => ecart(c.dateReception, c.dateTraitement)).filter((v): v is number => v !== null)),
          delaiExpedition: moyenne(cs.map(c => ecart(c.dateTraitement, c.dateExpedition)).filter((v): v is number => v !== null)),
          delaiLivraison: moyenne(cs.map(c => ecart(c.dateExpedition, c.dateLivraison)).filter((v): v is number => v !== null)),
          delaiTotal: moyenne(cs.map(c => ecart(c.dateReception, c.dateLivraison)).filter((v): v is number => v !== null)),
          attenteMax,
        };
      });

      return lignes.sort((a, b) => b.total - a.total);
    };

    const totalAnnulees = commandes.filter(c => c.statut === 'ANNULEE').length;
    const totalRefusees = commandes.filter(c => c.statut === 'REFUSEE').length;
    const totalLivrees = commandes.filter(c => c.statut === 'LIVREE').length;
    const baseGlobale = commandes.length - totalAnnulees - totalRefusees;

    return {
      totaux: {
        total: commandes.length,
        enAttente: commandes.filter(c => c.statut === 'EN_ATTENTE').length,
        enCours: commandes.filter(c => EN_COURS.includes(c.statut)).length,
        livrees: totalLivrees,
        refusees: totalRefusees,
        annulees: totalAnnulees,
        tauxLivraison: baseGlobale > 0 ? Math.round((totalLivrees / baseGlobale) * 100) : null,
      },
      parDepartement: ventile(c => c.departement),
      parDemandeur: ventile(c => c.demandeur ?? ''),
      parSociete: ventile(c => c.societe ?? ''),
      parManager: ventile(c => c.manager ?? ''),
    };
  }

  /**
   * Activité d'une journée : événements du cycle de commande survenus ce jour-là
   * (réception, validation Log1, expédition, livraison, refus), avec compteurs,
   * ventilation par logisticien et détail des commandes touchées.
   *
   * Particularités du modèle (vérifiées dans commandes.service.ts) :
   * - un refus écrit dateTraitement → refusées du jour = dateTraitement ∈ jour
   *   ET statut REFUSEE ; validées Log1 = dateTraitement ∈ jour ET statut ≠ REFUSEE ;
   * - l'annulation n'écrit aucune date jalon → approximée par updatedAt, ce qui
   *   peut sur-compter une commande annulée un autre jour puis modifiée ce jour-là
   *   (signalé côté interface) ;
   * - dateTransmissionLog2 est posée dans le même update que dateTraitement,
   *   donc inutile de la suivre séparément.
   */
  async getActiviteJour(filters: Record<string, string> = {}, userEntrepots: string[] = []) {
    const jour = filters.date || new Date().toISOString().split('T')[0];
    // Les deux bornes en interprétation locale serveur : 'YYYY-MM-DD' seul serait
    // parsé en UTC alors que 'T23:59:59' est parsé en local — fenêtre bancale.
    const debut = new Date(jour + 'T00:00:00');
    const fin = new Date(jour + 'T23:59:59.999');
    const fenetre = { gte: debut, lte: fin };

    const where: any = { deletedAt: null };
    applyCommonFilters(where, filters, userEntrepots, 'entrepotSource');
    where.OR = [
      { dateReception: fenetre },
      { dateTraitement: fenetre },
      { dateExpedition: fenetre },
      { dateLivraison: fenetre },
      { statut: 'ANNULEE', updatedAt: fenetre },
    ];

    const commandes = await this.prisma.commande.findMany({
      where,
      select: {
        numero: true,
        statut: true,
        departement: true,
        demandeur: true,
        societe: true,
        dateReception: true,
        dateTraitement: true,
        dateExpedition: true,
        dateLivraison: true,
        updatedAt: true,
        valideur: { select: { prenom: true, nom: true } },
        expediteur: { select: { prenom: true, nom: true } },
      },
      orderBy: { dateReception: 'desc' },
    });

    const dansJour = (d?: Date | null) => !!d && d >= debut && d <= fin;
    const maintenant = Date.now();

    const compteurs = { recues: 0, valideesLog1: 0, expediees: 0, livrees: 0, refusees: 0, annulees: 0 };

    const parLog = new Map<string, { validees: number; expediees: number }>();
    const bump = (nom: string, champ: 'validees' | 'expediees') => {
      if (!parLog.has(nom)) parLog.set(nom, { validees: 0, expediees: 0 });
      parLog.get(nom)![champ]++;
    };

    const detail = commandes.map(c => {
      const evenements: string[] = [];
      if (dansJour(c.dateReception)) { compteurs.recues++; evenements.push('RECUE'); }
      if (dansJour(c.dateTraitement)) {
        if (c.statut === 'REFUSEE') { compteurs.refusees++; evenements.push('REFUSEE'); }
        else {
          compteurs.valideesLog1++; evenements.push('VALIDEE');
          if (c.valideur) bump(`${c.valideur.prenom} ${c.valideur.nom}`, 'validees');
        }
      }
      if (dansJour(c.dateExpedition)) {
        compteurs.expediees++; evenements.push('EXPEDIEE');
        if (c.expediteur) bump(`${c.expediteur.prenom} ${c.expediteur.nom}`, 'expediees');
      }
      if (dansJour(c.dateLivraison)) { compteurs.livrees++; evenements.push('LIVREE'); }
      if (c.statut === 'ANNULEE' && dansJour(c.updatedAt)) { compteurs.annulees++; evenements.push('ANNULEE'); }

      // Durée du cycle si la commande est livrée ; sinon âge du dossier encore
      // ouvert, pour faire ressortir ce qui traîne.
      const dureeJours = c.dateLivraison && c.dateReception
        ? Math.round(((c.dateLivraison.getTime() - c.dateReception.getTime()) / 86400000) * 10) / 10
        : null;
      const enCours = !c.dateLivraison && c.statut !== 'ANNULEE' && c.statut !== 'REFUSEE';
      const ageJours = enCours && c.dateReception
        ? Math.round(((maintenant - c.dateReception.getTime()) / 86400000) * 10) / 10
        : null;

      return {
        numero: c.numero,
        demandeur: c.demandeur,
        departement: c.departement,
        statut: c.statut,
        evenements,
        dateReception: c.dateReception,
        dateTraitement: c.dateTraitement,
        dateExpedition: c.dateExpedition,
        dateLivraison: c.dateLivraison,
        dureeJours,
        ageJours,
      };
    });

    const parLogisticien = [...parLog.entries()]
      .map(([nom, v]) => ({ nom, ...v, total: v.validees + v.expediees }))
      .sort((a, b) => b.total - a.total);

    return { jour, compteurs, parLogisticien, commandes: detail };
  }

  /**
   * Export Excel de l'activité d'une journée : mêmes données que l'onglet
   * (on réutilise getActiviteJour pour garantir des chiffres identiques),
   * réparties sur 3 feuilles : synthèse, par logisticien, détail commandes.
   */
  async exportActiviteJour(filters: Record<string, string> = {}, userEntrepots: string[] = []) {
    const data = await this.getActiviteJour(filters, userEntrepots);

    const LABELS: Record<string, string> = {
      RECUE: 'Reçue', VALIDEE: 'Validée Log1', EXPEDIEE: 'Expédiée',
      LIVREE: 'Livrée', REFUSEE: 'Refusée', ANNULEE: 'Annulée',
    };
    const fmt = (d?: Date | null) => (d ? d.toISOString().split('T')[0] : '');

    const wb = new ExcelJS.Workbook();

    const styliser = (ws: ExcelJS.Worksheet) => {
      const h = ws.getRow(1);
      h.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6E' } };
      h.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      h.height = 30;
      ws.eachRow((r, i) => {
        if (i > 1 && i % 2 === 0) r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FC' } };
        r.eachCell(cell => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD0D7E4' } }, bottom: { style: 'thin', color: { argb: 'FFD0D7E4' } },
            left: { style: 'thin', color: { argb: 'FFD0D7E4' } }, right: { style: 'thin', color: { argb: 'FFD0D7E4' } },
          };
        });
      });
    };

    const ws1 = wb.addWorksheet('Synthèse');
    ws1.columns = [
      { header: 'Indicateur', key: 'k', width: 30 },
      { header: `Journée du ${data.jour}`, key: 'v', width: 18 },
    ];
    ws1.addRow({ k: 'Commandes reçues', v: data.compteurs.recues });
    ws1.addRow({ k: 'Validées Log1', v: data.compteurs.valideesLog1 });
    ws1.addRow({ k: 'Expédiées', v: data.compteurs.expediees });
    ws1.addRow({ k: 'Livrées', v: data.compteurs.livrees });
    ws1.addRow({ k: 'Refusées', v: data.compteurs.refusees });
    ws1.addRow({ k: 'Annulées (approximation)', v: data.compteurs.annulees });
    styliser(ws1);

    const ws2 = wb.addWorksheet('Par logisticien');
    ws2.columns = [
      { header: 'Logisticien', key: 'nom', width: 28 },
      { header: 'Validées Log1', key: 'validees', width: 14 },
      { header: 'Expédiées', key: 'expediees', width: 12 },
      { header: 'Total', key: 'total', width: 10 },
    ];
    for (const l of data.parLogisticien) ws2.addRow(l);
    styliser(ws2);

    const ws3 = wb.addWorksheet('Détail commandes');
    ws3.columns = [
      { header: 'N° Commande', key: 'numero', width: 20 },
      { header: 'Statut', key: 'statut', width: 16 },
      { header: 'Département', key: 'departement', width: 13 },
      { header: 'Demandeur', key: 'demandeur', width: 24 },
      { header: 'Événements du jour', key: 'evenements', width: 34 },
      { header: 'Réception', key: 'dateReception', width: 12 },
      { header: 'Validé Log1', key: 'dateTraitement', width: 12 },
      { header: 'Expédié', key: 'dateExpedition', width: 12 },
      { header: 'Livré', key: 'dateLivraison', width: 12 },
      { header: 'Durée récep.→livr. (j)', key: 'dureeJours', width: 16 },
      { header: 'Âge en cours (j)', key: 'ageJours', width: 14 },
    ];
    for (const cmd of data.commandes) {
      ws3.addRow({
        numero: cmd.numero,
        statut: cmd.statut,
        departement: cmd.departement,
        demandeur: cmd.demandeur ?? '',
        evenements: cmd.evenements.map(e => LABELS[e] ?? e).join(', '),
        dateReception: fmt(cmd.dateReception),
        dateTraitement: fmt(cmd.dateTraitement),
        dateExpedition: fmt(cmd.dateExpedition),
        dateLivraison: fmt(cmd.dateLivraison),
        dureeJours: cmd.dureeJours ?? '',
        ageJours: cmd.ageJours ?? '',
      });
    }
    ws3.views = [{ state: 'frozen', ySplit: 1 }];
    ws3.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws3.columns.length } };
    styliser(ws3);

    return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }
}
