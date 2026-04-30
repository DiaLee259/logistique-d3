import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { StatutCommande } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommandeDto } from './dto/create-commande.dto';
import { PdfService } from '../../pdf/pdf.service';
import * as ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CommandesService {
  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
  ) {}

  async findAll(filters: any) {
    const where: any = { deletedAt: null };
    if (filters.statut) where.statut = filters.statut;
    if (filters.departement) where.departement = { contains: filters.departement, mode: 'insensitive' };
    if (filters.entrepotId) {
      where.lignes = { some: {} }; // placeholder, join not easy here
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
      where.OR = [
        { numero: { contains: filters.search, mode: 'insensitive' } },
        { demandeur: { contains: filters.search, mode: 'insensitive' } },
        { departement: { contains: filters.search, mode: 'insensitive' } },
        { societe: { contains: filters.search, mode: 'insensitive' } },
        { manager: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = parseInt(filters.page || '1');
    const limit = parseInt(filters.limit || '20');

    const [data, total] = await Promise.all([
      this.prisma.commande.findMany({
        where,
        include: {
          lignes: { include: { article: { select: { id: true, nom: true, reference: true, unite: true } } } },
          valideur: { select: { id: true, nom: true, prenom: true } },
          expediteur: { select: { id: true, nom: true, prenom: true } },
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
        livraisons: true,
      },
    });
    if (!c || c.deletedAt) throw new NotFoundException('Commande introuvable');
    return c;
  }

  async create(dto: CreateCommandeDto) {
    const count = await this.prisma.commande.count();
    const numero = `CMD-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

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
        lignes: {
          select: {
            quantiteDemandee: true,
            quantiteValidee: true,
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
    const lien = await this.prisma.lienPrestataire.findUnique({ where: { token } });
    if (!lien || !lien.actif) throw new BadRequestException('Lien invalide ou expiré');
    if (lien.expiresAt && lien.expiresAt < new Date()) throw new BadRequestException('Lien expiré');

    const count = await this.prisma.commande.count();
    const numero = `CMD-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const commande = await this.prisma.commande.create({
      data: {
        numero,
        departement: dto.departement || 'Non défini',
        demandeur: dto.demandeur,
        emailDemandeur: dto.emailDemandeur,
        societe: dto.societe,
        interlocuteur: dto.interlocuteur,
        manager: dto.manager,
        nombreGrilles: dto.nombreGrilles ? parseInt(dto.nombreGrilles) : undefined,
        typeGrille: dto.typeGrille,
        telephoneDestinataire: dto.telephoneDestinataire,
        adresseLivraison: dto.adresseLivraison,
        commentaire: dto.commentaire,
        statut: StatutCommande.EN_ATTENTE,
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

    // Incrémenter le compteur d'utilisations
    await this.prisma.lienPrestataire.update({
      where: { token },
      data: { utilisations: { increment: 1 } },
    });

    // Notification broadcast
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

    for (const ligne of data.lignes || []) {
      const stock = await this.prisma.stock.findFirst({
        where: { articleId: commande.lignes.find(l => l.id === ligne.id)?.articleId },
      });
      await this.prisma.ligneCommande.update({
        where: { id: ligne.id },
        data: { quantiteValidee: ligne.quantiteValidee, stockDisponible: stock?.quantite ?? 0 },
      });
    }

    return this.prisma.commande.update({
      where: { id },
      data: {
        statut: StatutCommande.EN_ATTENTE_LOG2,  // → transmis à Log2
        valideurId: userId,
        dateTraitement: new Date(),
        dateTransmissionLog2: new Date(),
        commentaire: data.commentaire,
      },
      include: { lignes: { include: { article: true } }, valideur: true },
    });
  }

  async expedier(id: string, userId: string, commentaire?: string) {
    const commande = await this.findById(id);
    if (!['VALIDEE', 'EN_ATTENTE_LOG2'].includes(commande.statut)) {
      throw new BadRequestException('La commande doit être validée avant expédition');
    }

    // Créer un mouvement SORTIE pour chaque ligne validée
    for (const ligne of commande.lignes) {
      const qty = (ligne as any).quantiteValidee ?? (ligne as any).quantiteDemandee;
      if (!qty || qty <= 0) continue;

      // Entrepôt avec le plus de stock disponible pour cet article
      const stock = await this.prisma.stock.findFirst({
        where: { articleId: ligne.articleId },
        orderBy: { quantite: 'desc' },
      });

      let entrepotId: string;

      if (stock) {
        entrepotId = stock.entrepotId;
        // Décrémenter le stock existant
        await this.prisma.stock.update({
          where: { id: stock.id },
          data: { quantite: { decrement: qty } },
        });
      } else {
        // Pas de stock pour cet article → fallback sur le premier entrepôt actif
        const entrepot = await this.prisma.entrepot.findFirst({ where: { actif: true } });
        if (!entrepot) continue; // Aucun entrepôt configuré, on ne peut pas créer de mouvement
        entrepotId = entrepot.id;
        // Créer l'entrée stock (négatif = dette à régulariser via un inventaire)
        await this.prisma.stock.create({
          data: { articleId: ligne.articleId, entrepotId, quantite: -qty },
        });
      }

      await this.prisma.mouvement.create({
        data: {
          articleId: ligne.articleId,
          entrepotId,
          type: 'SORTIE' as any,
          quantiteDemandee: (ligne as any).quantiteDemandee,
          quantiteFournie: qty,
          departement: commande.departement,
          numeroCommande: commande.numero,
          sourceDestination: commande.demandeur ?? commande.societe ?? undefined,
          commandeId: id,
        },
      });
    }

    return this.prisma.commande.update({
      where: { id },
      data: {
        statut: StatutCommande.EXPEDIEE,
        expediteurId: userId,
        dateExpedition: new Date(),
        commentaireLog2: commentaire,
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

  async annuler(id: string) {
    return this.prisma.commande.update({ where: { id }, data: { statut: StatutCommande.ANNULEE } });
  }

  // ─── Liens prestataire ──────────────────────────────────────────────────────

  async genererLienPrestataire(nom: string, userId: string, expiresInDays?: number) {
    const token = uuidv4();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    return this.prisma.lienPrestataire.create({
      data: { token, nom, createdBy: userId, expiresAt },
    });
  }

  async listLiensPrestataire() {
    return this.prisma.lienPrestataire.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async desactiverLien(id: string) {
    return this.prisma.lienPrestataire.update({ where: { id }, data: { actif: false } });
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
    // Nullifier les FK sur mouvements et livraisons avant suppression
    await this.prisma.mouvement.updateMany({ where: { commandeId: id }, data: { commandeId: null } });
    await this.prisma.livraison.updateMany({ where: { commandeId: id }, data: { commandeId: null } });
    // LigneCommande a onDelete: Cascade → supprimées automatiquement
    return this.prisma.commande.delete({ where: { id } });
  }

  async viderCorbeille() {
    const items = await this.prisma.commande.findMany({
      where: { NOT: { deletedAt: null } },
      select: { id: true },
    });
    if (!items.length) return { count: 0 };
    const ids = items.map(i => i.id);
    await this.prisma.mouvement.updateMany({ where: { commandeId: { in: ids } }, data: { commandeId: null } });
    await this.prisma.livraison.updateMany({ where: { commandeId: { in: ids } }, data: { commandeId: null } });
    return this.prisma.commande.deleteMany({ where: { id: { in: ids } } });
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
    const lien = await this.prisma.lienPrestataire.findUnique({ where: { token } });
    if (!lien || !lien.actif) throw new NotFoundException('Lien invalide ou expiré');

    // Retourner la liste des articles pour le formulaire
    const articles = await this.prisma.article.findMany({
      where: { actif: true },
      select: { id: true, nom: true, reference: true, unite: true, description: true },
      orderBy: { createdAt: 'asc' },
    });

    return { lien: { nom: lien.nom, expiresAt: lien.expiresAt }, articles };
  }

  async importCommandes(buffer: Buffer, userId?: string) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    let created = 0;
    let skipped = 0;
    // Group rows by refGroupe
    const groups = new Map<string, any[]>();
    let rowIndex = 0;
    ws.eachRow((row, idx) => {
      if (idx === 1) return;
      const refGroupe = String(row.getCell(1).value ?? '').trim() || `__row_${rowIndex++}`;
      if (!groups.has(refGroupe)) groups.set(refGroupe, []);
      groups.get(refGroupe)!.push(row);
    });

    for (const [, rows] of groups) {
      const firstRow = rows[0];
      const demandeur = String(firstRow.getCell(2).value ?? '').trim();
      const departement = String(firstRow.getCell(3).value ?? '').trim();
      if (!demandeur || !departement) { skipped++; continue; }
      const emailDemandeur = String(firstRow.getCell(4).value ?? '').trim() || undefined;
      const telephoneDestinataire = String(firstRow.getCell(5).value ?? '').trim() || undefined;
      const adresseLivraison = String(firstRow.getCell(6).value ?? '').trim() || undefined;
      const commentaire = String(firstRow.getCell(7).value ?? '').trim() || undefined;

      const lignes: { articleId: string; quantiteDemandee: number }[] = [];
      for (const row of rows) {
        const refArticle = String(row.getCell(8).value ?? '').trim();
        const quantite = parseInt(String(row.getCell(9).value ?? '0')) || 0;
        if (!refArticle || !quantite) continue;
        const article = await this.prisma.article.findFirst({ where: { reference: refArticle } });
        if (article) lignes.push({ articleId: article.id, quantiteDemandee: quantite });
      }
      if (lignes.length === 0) { skipped++; continue; }

      try {
        const count = await this.prisma.commande.count();
        const numero = `CMD-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
        await this.prisma.commande.create({
          data: {
            numero,
            demandeur,
            departement,
            emailDemandeur,
            telephoneDestinataire,
            adresseLivraison,
            commentaire,
            lignes: { create: lignes },
          },
        });
        created++;
      } catch {
        skipped++;
      }
    }
    return { created, skipped, total: created + skipped };
  }
}
