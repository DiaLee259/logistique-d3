import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TypeMouvement } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StockCalculatorService } from '../stock-calculator.service';
import { CreateMouvementDto } from './dto/create-mouvement.dto';
import { FilterMouvementsDto } from './dto/filter-mouvements.dto';
import * as ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MouvementsService {
  constructor(
    private prisma: PrismaService,
    private calculator: StockCalculatorService,
  ) {}

  async findAll(filters: FilterMouvementsDto) {
    const where: any = {};

    if (filters.mois) {
      const [year, month] = filters.mois.split('-');
      where.date = {
        gte: new Date(parseInt(year), parseInt(month) - 1, 1),
        lt: new Date(parseInt(year), parseInt(month), 1),
      };
    } else if (filters.dateDebut || filters.dateFin) {
      where.date = {};
      if (filters.dateDebut) where.date.gte = new Date(filters.dateDebut);
      if (filters.dateFin) where.date.lte = new Date(filters.dateFin + 'T23:59:59');
    }
    if (filters.entrepotId) where.entrepotId = filters.entrepotId;
    if (filters.articleId) where.articleId = filters.articleId;
    if (filters.departement) where.departement = { contains: filters.departement, mode: 'insensitive' };
    if (filters.manager) where.manager = { contains: filters.manager, mode: 'insensitive' };
    if (filters.type) where.type = filters.type;
    if (filters.envoye !== undefined) where.envoye = filters.envoye === 'true';
    if (filters.recu !== undefined) where.recu = filters.recu === 'true';
    if ((filters as any).userEntrepots?.length) {
      where.entrepotId = { in: (filters as any).userEntrepots };
    }
    // Filtre transferts uniquement
    if ((filters as any).transfert === 'true') {
      where.transfertId = { not: null };
    }

    if (filters.search) {
      where.OR = [
        { article: { nom: { contains: filters.search, mode: 'insensitive' } } },
        { article: { reference: { contains: filters.search, mode: 'insensitive' } } },
        { numeroCommande: { contains: filters.search, mode: 'insensitive' } },
        { numeroOperation: { contains: filters.search, mode: 'insensitive' } },
        { departement: { contains: filters.search, mode: 'insensitive' } },
        { manager: { contains: filters.search, mode: 'insensitive' } },
        { sourceDestination: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = parseInt(filters.page || '1');
    const limit = parseInt(filters.limit || '20');
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.mouvement.findMany({
        where,
        include: {
          article: { select: { id: true, nom: true, reference: true, unite: true } },
          entrepot: { select: { id: true, code: true, nom: true } },
          user: { select: { id: true, nom: true, prenom: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.mouvement.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const m = await this.prisma.mouvement.findUnique({
      where: { id },
      include: { article: true, entrepot: true, user: true },
    });
    if (!m) throw new NotFoundException('Mouvement introuvable');
    return m;
  }

  async create(dto: CreateMouvementDto, userId?: string) {
    if (dto.type === TypeMouvement.SORTIE) {
      await this.validateStockSuffisant(dto.articleId, dto.entrepotId, dto.quantiteFournie);
    }

    const mouvement = await this.prisma.mouvement.create({
      data: { ...dto, userId },
      include: { article: true, entrepot: true },
    });

    await this.calculator.sync(dto.articleId, dto.entrepotId);
    return mouvement;
  }

  async createMultiple(items: CreateMouvementDto[], userId?: string) {
    const results = [];
    for (const dto of items) {
      results.push(await this.create(dto, userId));
    }
    return results;
  }

  async update(id: string, dto: Partial<CreateMouvementDto>) {
    const existing = await this.findById(id);

    const updated = await this.prisma.mouvement.update({
      where: { id },
      data: dto as any,
      include: { article: true, entrepot: true },
    });

    // Recalculer les deux couples potentiellement impactés (si articleId/entrepotId ont changé)
    await this.calculator.sync(updated.articleId, updated.entrepotId);
    if (dto.articleId !== existing.articleId || dto.entrepotId !== existing.entrepotId) {
      await this.calculator.sync(existing.articleId, existing.entrepotId);
    }
    return updated;
  }

  async delete(id: string) {
    const m = await this.findById(id);

    if (m.transfertId) {
      // Supprimer les deux legs du transfert atomiquement
      const legs = await this.prisma.mouvement.findMany({
        where: { transfertId: m.transfertId },
        select: { id: true, articleId: true, entrepotId: true },
      });
      await this.prisma.mouvement.deleteMany({ where: { transfertId: m.transfertId } });
      for (const leg of legs) {
        await this.calculator.sync(leg.articleId, leg.entrepotId);
      }
      return m;
    }

    await this.prisma.mouvement.delete({ where: { id } });
    await this.calculator.sync(m.articleId, m.entrepotId);
    return m;
  }

  /** Génère un numéro de transfert unique : TRF-YYYY-XXXX */
  private async genNumeroTransfert(): Promise<string> {
    const count = await this.prisma.mouvement.count({
      where: { transfertId: { not: null }, type: TypeMouvement.SORTIE },
    });
    return `TRF-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
  }

  /** Transfert inter-entrepôt : accepte plusieurs articles en une seule opération */
  async transferer(dto: {
    entrepotSourceId: string;
    entrepotDestinationId: string;
    lignes: { articleId: string; quantite: number }[];
    commentaire?: string;
    userId?: string;
  }) {
    if (dto.entrepotSourceId === dto.entrepotDestinationId) {
      throw new BadRequestException('Source et destination doivent être différentes');
    }
    if (!dto.lignes?.length) {
      throw new BadRequestException('Au moins un article requis');
    }

    const [entrepotSrc, entrepotDst] = await Promise.all([
      this.prisma.entrepot.findUnique({ where: { id: dto.entrepotSourceId } }),
      this.prisma.entrepot.findUnique({ where: { id: dto.entrepotDestinationId } }),
    ]);
    if (!entrepotSrc || !entrepotDst) throw new BadRequestException('Entrepôt introuvable');

    // Valider le stock pour chaque article
    for (const ligne of dto.lignes) {
      await this.validateStockSuffisant(ligne.articleId, dto.entrepotSourceId, ligne.quantite);
    }

    const transfertId = uuidv4();
    const numeroOperation = await this.genNumeroTransfert();
    const now = new Date();
    const results: any[] = [];

    for (const ligne of dto.lignes) {
      // SORTIE sur l'entrepôt source
      await this.prisma.mouvement.create({
        data: {
          articleId: ligne.articleId,
          entrepotId: dto.entrepotSourceId,
          type: TypeMouvement.SORTIE,
          quantiteDemandee: ligne.quantite,
          quantiteFournie: ligne.quantite,
          sourceDestination: `→ ${entrepotDst.code}`,
          numeroOperation,
          commentaire: dto.commentaire ?? null,
          userId: dto.userId ?? null,
          transfertId,
          date: now,
        },
      });

      // ENTREE sur l'entrepôt destination
      await this.prisma.mouvement.create({
        data: {
          articleId: ligne.articleId,
          entrepotId: dto.entrepotDestinationId,
          type: TypeMouvement.ENTREE,
          quantiteDemandee: ligne.quantite,
          quantiteFournie: ligne.quantite,
          sourceDestination: `← ${entrepotSrc.code}`,
          numeroOperation,
          commentaire: dto.commentaire ?? null,
          userId: dto.userId ?? null,
          transfertId,
          date: now,
        },
      });

      // Recalcul des deux entrepôts
      await this.calculator.sync(ligne.articleId, dto.entrepotSourceId);
      await this.calculator.sync(ligne.articleId, dto.entrepotDestinationId);
      results.push(ligne);
    }

    return {
      transfertId,
      numeroOperation,
      from: entrepotSrc.code,
      to: entrepotDst.code,
      lignes: results,
    };
  }

  async toggleField(id: string, field: 'envoye' | 'recu') {
    const m = await this.findById(id);
    return this.prisma.mouvement.update({
      where: { id },
      data: { [field]: !m[field] },
    });
  }

  async importMouvements(buffer: Buffer, userId?: string) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    const rows: ExcelJS.Row[] = [];
    ws.eachRow((row, idx) => { if (idx > 1) rows.push(row); });
    for (const row of rows) {
      const typeRaw = String(row.getCell(1).value ?? '').trim().toUpperCase();
      const dateRaw = String(row.getCell(2).value ?? '').trim();
      const refArticle = String(row.getCell(3).value ?? '').trim();
      const codeEntrepot = String(row.getCell(4).value ?? '').trim();
      const qteFournie = parseInt(String(row.getCell(5).value ?? '0')) || 0;
      const qteDemandeeRaw = row.getCell(6).value;
      const qteDemandee = qteDemandeeRaw ? parseInt(String(qteDemandeeRaw)) || qteFournie : qteFournie;
      const departement = String(row.getCell(7).value ?? '').trim() || undefined;
      const manager = String(row.getCell(8).value ?? '').trim() || undefined;
      const numeroCommande = String(row.getCell(9).value ?? '').trim() || undefined;
      const sourceDestination = String(row.getCell(10).value ?? '').trim() || undefined;
      const commentaire = String(row.getCell(11).value ?? '').trim() || undefined;

      if (!refArticle || !codeEntrepot || !qteFournie) { skipped++; continue; }
      if (typeRaw !== 'ENTREE' && typeRaw !== 'SORTIE') { errors.push(`Type invalide: ${typeRaw}`); skipped++; continue; }

      const article = await this.prisma.article.findFirst({ where: { reference: refArticle } });
      const entrepot = await this.prisma.entrepot.findFirst({ where: { code: codeEntrepot } });
      if (!article || !entrepot) { errors.push(`Article ou entrepôt introuvable: ${refArticle} / ${codeEntrepot}`); skipped++; continue; }

      const date = dateRaw ? new Date(dateRaw) : new Date();
      try {
        await this.create({
          articleId: article.id,
          entrepotId: entrepot.id,
          type: typeRaw as TypeMouvement,
          quantiteFournie: qteFournie,
          quantiteDemandee: qteDemandee,
          departement,
          manager,
          numeroCommande,
          sourceDestination,
          commentaire,
          date: date.toISOString(),
        } as any, userId);
        created++;
      } catch (e: any) {
        errors.push(e?.message ?? 'Erreur inconnue');
        skipped++;
      }
    }
    return { created, skipped, errors, total: created + skipped };
  }

  private async validateStockSuffisant(articleId: string, entrepotId: string, quantite: number) {
    const stock = await this.prisma.stock.findUnique({
      where: { articleId_entrepotId: { articleId, entrepotId } },
    });
    const stockActuel = stock?.quantite ?? 0;
    if (stockActuel < quantite) {
      throw new BadRequestException(`Stock insuffisant : disponible ${stockActuel}, demandé ${quantite}`);
    }
  }
}
