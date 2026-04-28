import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Injectable()
export class ArticlesService {
  constructor(private prisma: PrismaService) {}

  async findAll(entrepotId?: string) {
    const articles = await this.prisma.article.findMany({
      where: { actif: true },
      include: {
        stocks: {
          where: entrepotId ? { entrepotId } : undefined,
          include: { entrepot: { select: { id: true, code: true, nom: true } } },
        },
      },
      orderBy: { nom: 'asc' },
    });

    return articles.map(a => ({
      ...a,
      stockTotal: a.stocks.reduce((s, st) => s + st.quantite, 0),
      enAlerte: a.stocks.some(st => st.quantite <= a.seuilAlerte),
    }));
  }

  async findById(id: string) {
    const a = await this.prisma.article.findUnique({
      where: { id },
      include: { stocks: { include: { entrepot: true } } },
    });
    if (!a) throw new NotFoundException('Article introuvable');
    return a;
  }

  async create(dto: CreateArticleDto) {
    const exists = await this.prisma.article.findUnique({ where: { reference: dto.reference } });
    if (exists) throw new ConflictException('Référence déjà utilisée');
    return this.prisma.article.create({ data: dto });
  }

  async update(id: string, dto: UpdateArticleDto) {
    await this.findById(id);
    return this.prisma.article.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.article.update({ where: { id }, data: { actif: false } });
  }

  async getStockParArticle(entrepotId?: string) {
    const stocks = await this.prisma.stock.findMany({
      where: entrepotId ? { entrepotId } : undefined,
      include: {
        article: true,
        entrepot: { select: { id: true, code: true, nom: true } },
      },
    });
    return stocks;
  }

  async getStats(params: {
    entrepotId?: string;
    mois?: string;
    dateDebut?: string;
    dateFin?: string;
    departement?: string;
  }) {
    const { entrepotId, mois, dateDebut, dateFin, departement } = params;

    // Build date filter
    let dateFilter: any = {};
    if (mois) {
      const [y, m] = mois.split('-').map(Number);
      dateFilter = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    } else {
      if (dateDebut) dateFilter.gte = new Date(dateDebut);
      if (dateFin) dateFilter.lte = new Date(dateFin + 'T23:59:59');
    }

    const mouvWhere: any = {};
    if (entrepotId) mouvWhere.entrepotId = entrepotId;
    if (departement) mouvWhere.departement = { contains: departement, mode: 'insensitive' };
    if (Object.keys(dateFilter).length) mouvWhere.date = dateFilter;

    // Aggregate entrées and sorties per article
    const [entrees, sorties] = await Promise.all([
      this.prisma.mouvement.groupBy({
        by: ['articleId'],
        where: { ...mouvWhere, type: 'ENTREE' },
        _sum: { quantiteFournie: true },
      }),
      this.prisma.mouvement.groupBy({
        by: ['articleId'],
        where: { ...mouvWhere, type: 'SORTIE' },
        _sum: { quantiteFournie: true },
      }),
    ]);

    const entreesMap = Object.fromEntries(entrees.map(e => [e.articleId, e._sum.quantiteFournie ?? 0]));
    const sortiesMap = Object.fromEntries(sorties.map(s => [s.articleId, s._sum.quantiteFournie ?? 0]));

    const articles = await this.prisma.article.findMany({
      where: { actif: true },
      include: {
        stocks: {
          where: entrepotId ? { entrepotId } : undefined,
          include: { entrepot: { select: { id: true, code: true, nom: true } } },
        },
      },
      orderBy: { nom: 'asc' },
    });

    return articles.map(a => {
      const stockPhysique = a.stocks.reduce((s, st) => s + st.quantite, 0);
      const totalEntrees = entreesMap[a.id] ?? 0;
      const totalSorties = sortiesMap[a.id] ?? 0;
      const stockTheorique = totalEntrees - totalSorties;
      const ecart = stockPhysique - stockTheorique;
      return {
        ...a,
        stockTotal: stockPhysique,
        stockPhysique,
        stockTheorique,
        totalEntrees,
        totalSorties,
        ecart,
        enAlerte: a.stocks.some(st => st.quantite <= a.seuilAlerte),
      };
    });
  }
}
