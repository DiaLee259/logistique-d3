import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { StatutCommande } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StockCalculatorService } from '../../stock/stock-calculator.service';
import { CreateCommandeDto } from './dto/create-commande.dto';
import { PdfService } from '../../pdf/pdf.service';
import * as ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CommandesService {
  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
    private calculator: StockCalculatorService,
  ) {}

  async findAll(filters: any) {
    const where: any = { deletedAt: null };
    if (filters.statut) where.statut = filters.statut;
    if (filters.departement) where.departement = { contains: filters.departement, mode: 'insensitive' };
    if (filters.manager) where.manager = { contains: filters.manager, mode: 'insensitive' };
    if (filters.entrepotSource) where.entrepotSource = filters.entrepotSource;

    const andClauses: any[] = [];

    // Filtrage selon le rôle : manager de zone ou privilèges entrepôt
    if (filters.managerZone) {
      const mz = filters.managerZone as { id: string; nom: string; departements: any[] };
      const entrepotIds = [...new Set(
        (mz.departements as any[]).map((d: any) => d.entrepotId).filter(Boolean)
      )] as string[];
      andClauses.push({ OR: [
        { manager: { equals: mz.nom, mode: 'insensitive' } },
        ...(entrepotIds.length ? [{ entrepotSource: { in: entrepotIds } }] : []),
      ]});
    } else if (filters.userEntrepots?.length) {
      andClauses.push({ OR: [
        { entrepotSource: { in: filters.userEntrepots } },
        ...(filters.voirSansEntrepot !== false ? [{ entrepotSource: null }] : []),
      ]});
    }

    if (filters.dateDebut || filters.dateFin) {
      where.dateReception = {};
      if (filters.dateDebut) where.dateReception.gte = new Date(filters.dateDebut);
      if (filters.dateFin) where.dateReception.lte = new Date(filters.dateFin + 'T23:59:59');
    }
    if (filters.mois) {
      const [year, month] = filters.mois.split('-');
      where.dateReception = {
        gte: new Date(parseInt(year), parseInt(month) - 1, 1),
        lt: new Date(parseInt(year), parseInt(month), 1),
      };
    }
    if (filters.search) {
      andClauses.push({ OR: [
        { numero: { contains: filters.search, mode: 'insensitive' } },
        { demandeur: { contains: filters.search, mode: 'insensitive' } },
        { departement: { contains: filters.search, mode: 'insensitive' } },
        { societe: { contains: filters.search, mode: 'insensitive' } },
        { manager: { contains: filters.search, mode: 'insensitive' } },
      ]});
    }
    if (andClauses.length) where.AND = andClauses;

    const page = parseInt(filters.page || '1');
    const limit = parseInt(filters.limit || '20');

    const [data, total] = await Promise.all([
      this.prisma.commande.findMany({
        where,
        include: {
          lignes: { include: { article: { select: { id: true, nom: true, reference: true, unite: true } } } },
          valideur: { select: { id: true, nom: true, prenom: true } },
          expediteur: { select: { id: true, nom: true, prenom: true } },
          intervenant: { select: { id: true, nom: true, prenom: true } },
        },
        orderBy: { dateReception: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.commande.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const c = await this.prisma.commande.findUnique({
      where: { id },
      include: {
        lignes: { include: { article: true } },
        valideur: { select: { id: true, nom: true, prenom: true } },
        expediteur: { select: { id: true, nom: true, prenom: true } },
        intervenant: { select: { id: true, nom: true, prenom: true } },
        livraisons: true,
        lien: { select: { id: true, nom: true, token: true } },
      },
    });
    if (!c || c.deletedAt) throw new NotFoundException('Commande introuvable');
    return c;
  }

  private async genNumeroCommande(): Promise<string> {
    const count = await this.prisma.commande.count();
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `CMD-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}-${suffix}`;
  }

  async create(dto: CreateCommandeDto) {
    const numero = await this.genNumeroCommande();

    const commande = await this.prisma.commande.create({
      data: {
        numero,
        departement: dto.departement,
        demandeur: dto.demandeur,
        emailDemandeur: dto.emailDemandeur,
        societe: dto.societe,
        interlocuteur: dto.interlocuteur,
        manager: dto.manager,
        nombreGrilles: dto.nombreGrilles,
        typeGrille: dto.typeGrille,
        telephoneDestinataire: (dto as any).telephoneDestinataire,
        adresseLivraison: (dto as any).adresseLivraison,
        dateCommande: dto.dateCommande ? new Date(dto.dateCommande) : undefined,
        commentaire: dto.commentaire,
        fichierExcelUrl: dto.fichierExcelUrl,
        intervenantId: dto.intervenantId ?? undefined,
        lignes: {
          create: dto.lignes.map(l => ({
            articleId: l.articleId,
            quantiteDemandee: l.quantiteDemandee,
            commentaire: l.commentaire,
          })),
        },
      },
      include: { lignes: { include: { article: true } } },
    });

    // Notification broadcast
    await this.prisma.notification.create({
      data: {
        type: 'NOUVELLE_COMMANDE',
        titre: 'Nouvelle commande reçue',
        message: `${numero} — Dept. ${dto.departement}${dto.demandeur ? ` — ${dto.demandeur}` : ''}${dto.societe ? ` (${dto.societe})` : ''}`,
        lien: `/commandes/${commande.id}`,
      },
    });

    return commande;
  }

  // Refuser une commande (Log1) avec motif obligatoire
  async refuser(id: string, motif: string) {
    const commande = await this.findById(id);
    if (!['EN_ATTENTE', 'EN_VALIDATION'].includes(commande.statut)) {
      throw new BadRequestException('Seule une commande en attente peut être refusée');
    }
    if (!motif?.trim()) {
      throw new BadRequestException('Un motif de refus est obligatoire');
    }
    return this.prisma.commande.update({
      where: { id },
      data: {
        statut: 'REFUSEE' as any,
        commentaireRefus: motif.trim(),
        dateTraitement: new Date(),
      },
    });
  }

  // Suivi public d'une commande par numéro
  async getSuiviPublic(numero: string) {
    const commande = await this.prisma.commande.findFirst({
      where: { numero: { equals: numero.toUpperCase(), mode: 'insensitive' } },
      select: {
        id: true,
        numero: true,
        statut: true,
        departement: true,
        demandeur: true,
        societe: true,
        dateReception: true,
        dateTraitement: true,
        dateExpedition: true,
        dateLivraison: true,
        commentaireRefus: true,
        lignes: {
          select: {
            quantiteDemandee: true,
            quantiteValidee: true,
            quantiteFournie: true,
            article: { select: { nom: true, reference: true, unite: true } },
          },
        },
      },
    });
    if (!commande) throw new NotFoundException('Commande introuvable');
    return commande;
  }

  // Créer depuis formulaire public prestataire
  async createPublique(token: string, dto: any) {
    const lien = await this.prisma.lienPrestataire.findUnique({
      where: { token },
      include: { managerZone: true },
    });
    if (!lien || !lien.actif) throw new BadRequestException('Lien invalide ou expiré');
    if (lien.expiresAt && lien.expiresAt < new Date()) throw new BadRequestException('Lien expiré');

    // Détecter l'entrepôt depuis le(s) département(s) sélectionné(s)
    // dto.departement peut être "49" ou "49,75" (multi-sélection)
    let entrepotSource: string | undefined;
    if (lien.managerZone && dto.departement) {
      const depts = lien.managerZone.departements as { code: string; entrepotId: string; entrepotCode: string }[];
      const selectedCodes = String(dto.departement).split(',').map((s: string) => s.trim()).filter(Boolean);
      const matchedEntrepots = [...new Set(
        selectedCodes.map(code => depts.find(d => d.code === code)?.entrepotId).filter(Boolean)
      )] as string[];
      // Un seul entrepôt commun → on l'assigne ; plusieurs → null (Log1 tranchera)
      if (matchedEntrepots.length === 1) entrepotSource = matchedEntrepots[0];
    }

    const numero = await this.genNumeroCommande();

    const commande = await this.prisma.commande.create({
      data: {
        numero,
        departement: dto.departement || 'Non défini',
        demandeur: dto.demandeur,
        emailDemandeur: dto.emailDemandeur,
        societe: dto.societe,
        interlocuteur: dto.interlocuteur,
        manager: lien.managerZone?.nom ?? dto.manager,
        nombreGrilles: dto.nombreGrilles ? parseInt(dto.nombreGrilles) : undefined,
        typeGrille: dto.typeGrille,
        telephoneDestinataire: dto.telephoneDestinataire,
        adresseLivraison: dto.adresseLivraison,
        commentaire: dto.commentaire,
        statut: StatutCommande.EN_ATTENTE,
        entrepotSource: entrepotSource ?? null,
        lienId: lien.id,
        typePrestataire: lien.typePrestataire ?? null,
        lignes: {
          create: (dto.lignes || []).map((l: any) => ({
            articleId: l.articleId,
            quantiteDemandee: parseInt(l.quantiteDemandee) || 1,
            commentaire: l.commentaire,
          })),
        },
      },
      include: { lignes: { include: { article: true } } },
    });

    await this.prisma.lienPrestataire.update({
      where: { token },
      data: { utilisations: { increment: 1 } },
    });

    await this.prisma.notification.create({
      data: {
        type: 'NOUVELLE_COMMANDE',
        titre: 'Nouvelle commande reçue (prestataire)',
        message: `${numero} — Dept. ${dto.departement || 'NC'}${dto.demandeur ? ` — ${dto.demandeur}` : ''}${dto.societe ? ` (${dto.societe})` : ''}`,
        lien: `/commandes/${commande.id}`,
      },
    });

    return commande;
  }

  async valider(id: string, data: any, userId: string) {
    const commande = await this.findById(id);
    if (!['EN_ATTENTE', 'EN_VALIDATION'].includes(commande.statut)) {
      throw new BadRequestException('Commande ne peut pas être validée dans cet état');
    }

    const entrepotId = data.entrepotSource ?? undefined;
    const stockRef = entrepotId
      ? null
      : await this.prisma.stock.findFirst({ orderBy: { quantite: 'desc' } });

    // Mettre à jour les lignes existantes
    for (const ligne of data.lignes || []) {
      const ligneCmd = commande.lignes.find(l => l.id === ligne.id);
      const stock = entrepotId
        ? await this.prisma.stock.findUnique({ where: { articleId_entrepotId: { articleId: ligneCmd?.articleId ?? '', entrepotId } } })
        : stockRef;

      await this.prisma.ligneCommande.update({
        where: { id: ligne.id },
        data: {
          quantiteValidee: ligne.quantiteValidee,
          stockDisponible: stock?.quantite ?? 0,
        },
      });
    }

    // Créer les nouvelles lignes ajoutées par Log1 (article substitué)
    for (const nl of data.nouvelleLignes || []) {
      if (!nl.articleId || nl.quantiteValidee <= 0) continue;
      const stock = entrepotId
        ? await this.prisma.stock.findUnique({ where: { articleId_entrepotId: { articleId: nl.articleId, entrepotId } } })
        : stockRef;
      await this.prisma.ligneCommande.create({
        data: {
          commandeId: id,
          articleId: nl.articleId,
          quantiteDemandee: nl.quantiteValidee,
          quantiteValidee: nl.quantiteValidee,
          stockDisponible: stock?.quantite ?? 0,
          commentaire: nl.commentaire ?? null,
        },
      });
    }

    return this.prisma.commande.update({
      where: { id },
      data: {
        statut: StatutCommande.EN_ATTENTE_LOG2,
        valideurId: userId,
        dateTraitement: new Date(),
        dateTransmissionLog2: new Date(),
        commentaire: data.commentaire,
        entrepotSource: data.entrepotSource ?? null,
      },
      include: { lignes: { include: { article: true } }, valideur: true },
    });
  }

  async updateDetails(id: string, data: Record<string, any>) {
    const commande = await this.findById(id);
    if (['EXPEDIEE', 'LIVREE', 'ANNULEE'].includes(commande.statut)) {
      throw new BadRequestException('Impossible de modifier une commande expédiée, livrée ou annulée');
    }
    const allowed = ['departement', 'demandeur', 'emailDemandeur', 'societe', 'manager',
      'telephoneDestinataire', 'adresseLivraison', 'commentaire', 'nombreGrilles', 'typeGrille', 'intervenantId'];
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (!(key in data)) continue;
      if (key === 'nombreGrilles') {
        update[key] = data[key] !== '' && data[key] != null ? parseInt(String(data[key])) || null : null;
      } else {
        update[key] = data[key] || null;
      }
    }
    return this.prisma.commande.update({ where: { id }, data: update });
  }

  async expedier(id: string, userId: string, data: { commentaire?: string; lignes?: { ligneId: string; quantite: number }[]; nouvelleLignes?: { articleId: string; quantite: number; commentaire?: string }[] }) {
    const commande = await this.findById(id);
    if (!['VALIDEE', 'EN_ATTENTE_LOG2'].includes(commande.statut)) {
      throw new BadRequestException('La commande doit être validée avant expédition');
    }

    let entrepotId: string | undefined = (commande as any).entrepotSource ?? undefined;
    if (!entrepotId) {
      const stock = await this.prisma.stock.findFirst({ orderBy: { quantite: 'desc' } });
      entrepotId = stock?.entrepotId ?? (await this.prisma.entrepot.findFirst({ where: { actif: true } }))?.id;
    }
    if (!entrepotId) throw new BadRequestException('Aucun entrepôt disponible pour l\'expédition');

    // Traiter les lignes existantes
    for (const ligne of commande.lignes) {
      const ligneOverride = data.lignes?.find(l => l.ligneId === ligne.id);
      const quantiteLivree = ligneOverride?.quantite ?? (ligne as any).quantiteValidee ?? (ligne as any).quantiteDemandee;
      if (!quantiteLivree || quantiteLivree <= 0) continue;

      await this.prisma.ligneCommande.update({
        where: { id: ligne.id },
        data: { quantiteFournie: quantiteLivree },
      });

      await this.prisma.mouvement.create({
        data: {
          articleId: ligne.articleId,
          entrepotId,
          type: 'SORTIE' as any,
          quantiteDemandee: (ligne as any).quantiteDemandee,
          quantiteValidee: (ligne as any).quantiteValidee ?? null,
          quantiteFournie: quantiteLivree,
          departement: commande.departement,
          manager: (commande as any).manager ?? null,
          numeroCommande: commande.numero,
          numeroOperation: commande.numero,
          sourceDestination: commande.demandeur ?? commande.societe ?? undefined,
          commandeId: id,
        } as any,
      });

      await this.calculator.sync(ligne.articleId, entrepotId);
    }

    // Créer et expédier les nouvelles lignes ajoutées par Log2 (article substitué)
    for (const nl of data.nouvelleLignes || []) {
      if (!nl.articleId || nl.quantite <= 0) continue;
      const nouvelleLigne = await this.prisma.ligneCommande.create({
        data: {
          commandeId: id,
          articleId: nl.articleId,
          quantiteDemandee: nl.quantite,
          quantiteValidee: nl.quantite,
          quantiteFournie: nl.quantite,
          commentaire: nl.commentaire ?? null,
        },
      });

      await this.prisma.mouvement.create({
        data: {
          articleId: nl.articleId,
          entrepotId,
          type: 'SORTIE' as any,
          quantiteDemandee: nl.quantite,
          quantiteValidee: nl.quantite,
          quantiteFournie: nl.quantite,
          departement: commande.departement,
          manager: (commande as any).manager ?? null,
          numeroCommande: commande.numero,
          numeroOperation: commande.numero,
          sourceDestination: commande.demandeur ?? commande.societe ?? undefined,
          commandeId: id,
        } as any,
      });

      await this.calculator.sync(nl.articleId, entrepotId);
    }

    return this.prisma.commande.update({
      where: { id },
      data: {
        statut: StatutCommande.EXPEDIEE,
        expediteurId: userId,
        dateExpedition: new Date(),
        commentaireLog2: data.commentaire,
      },
    });
  }

  async marquerLivree(id: string) {
    const commande = await this.findById(id);
    if (commande.statut !== StatutCommande.EXPEDIEE) {
      throw new BadRequestException('La commande doit être expédiée pour être marquée livrée');
    }
    return this.prisma.commande.update({
      where: { id },
      data: { statut: StatutCommande.LIVREE, dateLivraison: new Date() },
    });
  }

  async genererFichePerception(id: string): Promise<Buffer> {
    const commande = await this.findById(id);
    return this.pdfService.genererFichePerception(commande as any);
  }

  async marquerEmailEnvoye(id: string) {
    return this.prisma.commande.update({
      where: { id },
      data: { emailEnvoye: true, dateEmailEnvoye: new Date() },
    });
  }

  async marquerBonRetourRecu(id: string, url?: string) {
    return this.prisma.commande.update({
      where: { id },
      data: { bonRetourRecu: true, dateBonRetourRecu: new Date(), bonRetourUrl: url },
    });
  }

  async annuler(id: string, motif?: string) {
    return this.prisma.commande.update({
      where: { id },
      data: {
        statut: StatutCommande.ANNULEE,
        ...(motif?.trim() ? { commentaireRefus: motif.trim() } : {}),
      },
    });
  }

  // ─── Liens prestataire ──────────────────────────────────────────────────────

  async genererLienPrestataire(data: {
    nom: string;
    expiresInDays?: number;
    managerZoneId?: string;
    typePrestataire?: string;
    departementsActifs?: string[];
  }, userId: string) {
    const token = uuidv4();
    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    return this.prisma.lienPrestataire.create({
      data: {
        token,
        nom: data.nom,
        createdBy: userId,
        expiresAt,
        managerZoneId: data.managerZoneId ?? null,
        typePrestataire: data.typePrestataire ?? null,
        departementsActifs: data.departementsActifs ?? [],
      },
      include: { managerZone: true },
    });
  }

  async updateLienPrestataire(id: string, data: {
    nom?: string;
    managerZoneId?: string | null;
    typePrestataire?: string | null;
    departementsActifs?: string[];
    actif?: boolean;
  }) {
    return this.prisma.lienPrestataire.update({
      where: { id },
      data,
      include: { managerZone: true },
    });
  }

  async listLiensPrestataire() {
    return this.prisma.lienPrestataire.findMany({
      orderBy: { createdAt: 'desc' },
      include: { managerZone: { select: { id: true, nom: true, departements: true } } },
    });
  }

  // ─── Managers de zone ───────────────────────────────────────────────────────

  async listManagersZone() {
    return this.prisma.managerZone.findMany({
      orderBy: { nom: 'asc' },
      include: { liens: { where: { actif: true }, select: { id: true, nom: true } } },
    });
  }

  async createManagerZone(data: { nom: string; departements: any[] }) {
    return this.prisma.managerZone.create({ data });
  }

  async updateManagerZone(id: string, data: { nom?: string; departements?: any[]; actif?: boolean }) {
    return this.prisma.managerZone.update({ where: { id }, data });
  }

  async deleteManagerZone(id: string) {
    return this.prisma.managerZone.delete({ where: { id } });
  }

  async desactiverLien(id: string) {
    return this.prisma.lienPrestataire.update({ where: { id }, data: { actif: false } });
  }

  async deleteLienPrestataire(id: string) {
    return this.prisma.lienPrestataire.delete({ where: { id } });
  }

  async bulkSetEntrepot(commandeIds: string[], entrepotId: string) {
    const result = await this.prisma.commande.updateMany({
      where: { id: { in: commandeIds }, deletedAt: null },
      data: { entrepotSource: entrepotId },
    });
    return { updated: result.count };
  }

  async delete(id: string, userId?: string) {
    let deletedByName = 'Inconnu';
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { prenom: true, nom: true } });
      if (user) deletedByName = `${user.prenom} ${user.nom}`;
    }
    return this.prisma.commande.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId, deletedByName },
    });
  }

  async restore(id: string) {
    return this.prisma.commande.update({
      where: { id },
      data: { deletedAt: null, deletedById: null, deletedByName: null },
    });
  }

  async supprimerDefinitivement(id: string) {
    const mouvements = await this.prisma.mouvement.findMany({
      where: { commandeId: id },
      select: { articleId: true, entrepotId: true },
    });

    await this.prisma.mouvement.deleteMany({ where: { commandeId: id } });
    await this.prisma.livraison.updateMany({ where: { commandeId: id }, data: { commandeId: null } });
    const result = await this.prisma.commande.delete({ where: { id } });

    const pairs = new Map<string, { articleId: string; entrepotId: string }>();
    for (const m of mouvements) pairs.set(`${m.articleId}:${m.entrepotId}`, m);
    for (const p of pairs.values()) await this.calculator.sync(p.articleId, p.entrepotId);

    return result;
  }

  async viderCorbeille() {
    const items = await this.prisma.commande.findMany({
      where: { NOT: { deletedAt: null } },
      select: { id: true },
    });
    if (!items.length) return { count: 0 };
    const ids = items.map(i => i.id);

    const mouvements = await this.prisma.mouvement.findMany({
      where: { commandeId: { in: ids } },
      select: { articleId: true, entrepotId: true },
    });

    await this.prisma.mouvement.deleteMany({ where: { commandeId: { in: ids } } });
    await this.prisma.livraison.updateMany({ where: { commandeId: { in: ids } }, data: { commandeId: null } });
    const result = await this.prisma.commande.deleteMany({ where: { id: { in: ids } } });

    const pairs = new Map<string, { articleId: string; entrepotId: string }>();
    for (const m of mouvements) pairs.set(`${m.articleId}:${m.entrepotId}`, m);
    for (const p of pairs.values()) await this.calculator.sync(p.articleId, p.entrepotId);

    return result;
  }

  async findCorbeille() {
    return this.prisma.commande.findMany({
      where: { NOT: { deletedAt: null } },
      select: {
        id: true, numero: true, departement: true, demandeur: true, societe: true,
        deletedAt: true, deletedByName: true,
        lignes: { select: { quantiteDemandee: true, article: { select: { nom: true } } } },
      },
      orderBy: { deletedAt: 'desc' },
    });
  }

  async getLienPublic(token: string) {
    const lien = await this.prisma.lienPrestataire.findUnique({
      where: { token },
      include: { managerZone: true },
    });
    if (!lien || !lien.actif) throw new NotFoundException('Lien invalide ou expiré');

    const articles = await this.prisma.article.findMany({
      where: { actif: true },
      select: { id: true, nom: true, reference: true, unite: true, description: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      lien: {
        nom: lien.nom,
        expiresAt: lien.expiresAt,
        typePrestataire: lien.typePrestataire,
        managerNom: lien.managerZone?.nom ?? null,
        departementsActifs: lien.departementsActifs,
      },
      articles,
    };
  }

  async importCommandes(buffer: Buffer, userId?: string) {
    // 1 fichier = 1 commande. La 1ère ligne de données fournit les infos commande (col A-F).
    // Chaque ligne contribue un article (col G = référence, col H = désignation ignorée, col I = quantité).
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    // Chercher l'onglet "Commande" (insensible à la casse), sinon prendre le premier onglet non-instructions
    const ws = wb.worksheets.find(s => s.name.toLowerCase() === 'commande')
      ?? wb.worksheets.find(s => !s.name.includes('Instructions') && !s.name.includes('📋'))
      ?? wb.worksheets[0];
    if (!ws) return { created: 0, skipped: 0, errors: ['Fichier Excel vide ou invalide'], total: 0 };

    const dataRows: any[] = [];
    ws.eachRow((row, idx) => { if (idx > 1) dataRows.push(row); });
    if (dataRows.length === 0) return { created: 0, skipped: 0, errors: ['Aucune ligne de données'], total: 0 };

    // Auto-détection du format : ancien (refArticle=G/7, qte=I/9) ou nouveau (refArticle=I/9, qte=K/11)
    const headerRow = ws.getRow(1);
    const colGHeader = String(headerRow.getCell(7).value ?? '').toLowerCase();
    const isOldFormat = colGHeader.includes('réf') || colGHeader.includes('ref') || colGHeader.includes('article');
    const refCol = isOldFormat ? 7 : 9;
    const qteCol = isOldFormat ? 9 : 11;

    const firstRow = dataRows[0];
    const demandeur = String(firstRow.getCell(1).value ?? '').trim();
    const departement = String(firstRow.getCell(2).value ?? '').trim();
    if (!demandeur || !departement)
      return { created: 0, skipped: dataRows.length, errors: ['Demandeur et Département requis (colonnes A et B)'], total: dataRows.length };

    let societe: string | undefined, manager: string | undefined,
        emailDemandeur: string | undefined, telephoneDestinataire: string | undefined,
        adresseLivraison: string | undefined, commentaire: string | undefined;

    if (isOldFormat) {
      // Ancien format : A=demandeur B=dept C=email D=tel E=adresse F=commentaire
      emailDemandeur        = String(firstRow.getCell(3).value ?? '').trim() || undefined;
      telephoneDestinataire = String(firstRow.getCell(4).value ?? '').trim() || undefined;
      adresseLivraison      = String(firstRow.getCell(5).value ?? '').trim() || undefined;
      commentaire           = String(firstRow.getCell(6).value ?? '').trim() || undefined;
    } else {
      // Nouveau format : A=demandeur B=dept C=société D=manager E=email F=tel G=adresse H=commentaire
      societe               = String(firstRow.getCell(3).value ?? '').trim() || undefined;
      manager               = String(firstRow.getCell(4).value ?? '').trim() || undefined;
      emailDemandeur        = String(firstRow.getCell(5).value ?? '').trim() || undefined;
      telephoneDestinataire = String(firstRow.getCell(6).value ?? '').trim() || undefined;
      adresseLivraison      = String(firstRow.getCell(7).value ?? '').trim() || undefined;
      commentaire           = String(firstRow.getCell(8).value ?? '').trim() || undefined;
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    const lignes: { articleId: string; quantiteDemandee: number }[] = [];
    for (const row of dataRows) {
      const refArticle = String(row.getCell(refCol).value ?? '').trim();
      const quantite = parseInt(String(row.getCell(qteCol).value ?? '0')) || 0;
      if (!refArticle) continue;
      if (!quantite) { errors.push(`Quantité invalide pour l'article "${refArticle}"`); skipped++; continue; }
      const article = await this.prisma.article.findFirst({ where: { reference: refArticle } });
      if (!article) { errors.push(`Article introuvable : "${refArticle}"`); skipped++; continue; }
      lignes.push({ articleId: article.id, quantiteDemandee: quantite });
    }

    if (lignes.length === 0)
      return { created: 0, skipped, errors: [...errors, 'Aucun article valide trouvé'], total: dataRows.length };

    try {
      const numero = await this.genNumeroCommande();
      await this.prisma.commande.create({
        data: {
          numero,
          demandeur,
          departement,
          societe,
          manager,
          emailDemandeur,
          telephoneDestinataire,
          adresseLivraison,
          commentaire,
          lignes: { create: lignes },
        },
      });
      created++;
    } catch (err: any) {
      errors.push(`Erreur création commande : ${err?.message ?? String(err)}`);
      skipped++;
    }
    return { created, skipped, errors, total: lignes.length + skipped };
  }

  /**
   * Backfill one-shot : pour chaque commande liée à un lien prestataire,
   * récupère manager, typePrestataire et entrepotSource depuis ce lien.
   * Ne modifie que les champs actuellement null/vides.
   */
  async backfillLienData() {
    const commandes = await this.prisma.commande.findMany({
      where: { lienId: { not: null }, deletedAt: null },
      select: {
        id: true,
        departement: true,
        manager: true,
        typePrestataire: true,
        entrepotSource: true,
        lienId: true,
      },
    });

    let updated = 0;
    let skipped = 0;
    const details: string[] = [];

    for (const cmd of commandes) {
      const lien = await this.prisma.lienPrestataire.findUnique({
        where: { id: cmd.lienId! },
        include: { managerZone: true },
      });
      if (!lien) { skipped++; continue; }

      const patch: Record<string, any> = {};

      // Manager ← managerZone.nom
      if (!cmd.manager && lien.managerZone?.nom) {
        patch.manager = lien.managerZone.nom;
      }

      // typePrestataire ← lien.typePrestataire
      if (!cmd.typePrestataire && lien.typePrestataire) {
        patch.typePrestataire = lien.typePrestataire;
      }

      // entrepotSource ← résolution depuis managerZone.departements + commande.departement
      if (!cmd.entrepotSource && lien.managerZone && cmd.departement) {
        const depts = lien.managerZone.departements as { code: string; entrepotId: string }[];
        const selectedCodes = String(cmd.departement).split(',').map(s => s.trim()).filter(Boolean);
        const matchedEntrepots = [...new Set(
          selectedCodes.map(code => depts.find(d => d.code === code)?.entrepotId).filter(Boolean)
        )] as string[];
        if (matchedEntrepots.length === 1) {
          patch.entrepotSource = matchedEntrepots[0];
        }
      }

      if (Object.keys(patch).length === 0) { skipped++; continue; }

      await this.prisma.commande.update({ where: { id: cmd.id }, data: patch });
      updated++;
      details.push(`${cmd.id}: ${Object.keys(patch).join(', ')}`);
    }

    return { total: commandes.length, updated, skipped, details };
  }
}
