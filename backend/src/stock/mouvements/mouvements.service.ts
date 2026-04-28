import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TypeMouvement } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMouvementDto } from './dto/create-mouvement.dto';
import { FilterMouvementsDto } from './dto/filter-mouvements.dto';

@Injectable()
export class MouvementsService {
  constructor(private prisma: PrismaService) {}

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
    if (filters.type) where.type = filters.type;
    if (filters.envoye !== undefined) where.envoye = filters.envoye === 'true';
    if (filters.recu !== undefined) where.recu = filters.recu === 'true';
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
    // Valider stock pour sortie
    if (dto.type === TypeMouvement.SORTIE) {
      await this.validateStockSuffisant(dto.articleId, dto.entrepotId, dto.quantiteFournie);
    }

    const mouvement = await this.prisma.mouvement.create({
      data: { ...dto, userId },
      include: { article: true, entrepot: true },
    });

    await this.updateStock(dto.articleId, dto.entrepotId, dto.type, dto.quantiteFournie);
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

    // Inverser l'ancien mouvement sur le stock
    const typeInverse = existing.type === TypeMouvement.ENTREE ? TypeMouvement.SORTIE : TypeMouvement.ENTREE;
    await this.updateStock(existing.articleId, existing.entrepotId, typeInverse, existing.quantiteFournie);

    // Valider et appliquer le nouveau
    if (dto.type === TypeMouvement.SORTIE || existing.type === TypeMouvement.SORTIE) {
      const newQte = dto.quantiteFournie ?? existing.quantiteFournie;
      const newType = dto.type ?? existing.type;
      const newArticle = dto.articleId ?? existing.articleId;
      const newEntrepot = dto.entrepotId ?? existing.entrepotId;
      if (newType === TypeMouvement.SORTIE) {
        await this.validateStockSuffisant(newArticle, newEntrepot, newQte);
      }
    }

    const updated = await this.prisma.mouvement.update({
      where: { id },
      data: dto as any,
      include: { article: true, entrepot: true },
    });

    await this.updateStock(updated.articleId, updated.entrepotId, updated.type, updated.quantiteFournie);
    return updated;
  }

  async delete(id: string) {
    const m = await this.findById(id);
    if (m.type === TypeMouvement.SORTIE) {
      await this.updateStock(m.articleId, m.entrepotId, TypeMouvement.ENTREE, m.quantiteFournie);
    } else {
      await this.validateStockSuffisant(m.articleId, m.entrepotId, m.quantiteFournie);
      await this.updateStock(m.articleId, m.entrepotId, TypeMouvement.SORTIE, m.quantiteFournie);
    }
    return this.prisma.mouvement.delete({ where: { id } });
  }

  async toggleField(id: string, field: 'envoye' | 'recu') {
    const m = await this.findById(id);
    return this.prisma.mouvement.update({
      where: { id },
      data: { [field]: !m[field] },
    });
  }

  private async validateStockSuffisant(articleId: string, entrepotId: string, quantite: number) {
    const stock = await this.prisma.stock.findUnique({
      where: { articleId_entrepotId: { articleId, entrepotId } },
    });
    const stockActuel = stock?.quantite ?? 0;
    if (stockActuel < quantite) {
      throw new BadRequestException(
        `Stock insuffisant : disponible ${stockActuel}, demandé ${quantite}`,
      );
    }
  }

  private async updateStock(articleId: string, entrepotId: string, type: TypeMouvement, quantite: number) {
    const delta = type === TypeMouvement.ENTREE ? quantite : -quantite;
    await this.prisma.stock.upsert({
      where: { articleId_entrepotId: { articleId, entrepotId } },
      update: { quantite: { increment: delta } },
      create: { articleId, entrepotId, quantite: Math.max(0, delta) },
    });
  }
}
