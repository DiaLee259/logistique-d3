import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ArticlesService {
  constructor(private prisma: PrismaService) {}

  async findAll(entrepotId?: string, includeInactif = false) {
    const articles = await this.prisma.article.findMany({
      where: includeInactif ? undefined : { actif: true },
      include: {
        stocks: {
          where: entrepotId ? { entrepotId } : undefined,
          include: { entrepot: { select: { id: true, code: true, nom: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
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

  async importArticles(buffer: Buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    let created = 0;
    let skipped = 0;
    const rows: ExcelJS.Row[] = [];
    ws.eachRow((row, idx) => { if (idx > 1) rows.push(row); });
    for (const row of rows) {
      const reference = String(row.getCell(1).value ?? '').trim();
      const nom = String(row.getCell(2).value ?? '').trim();
      if (!reference || !nom) { skipped++; continue; }
      const description = String(row.getCell(3).value ?? '').trim() || undefined;
      const unite = String(row.getCell(4).value ?? '').trim() || 'unité';
      const seuilAlerte = parseInt(String(row.getCell(5).value ?? '0')) || 0;
      try {
        await this.prisma.article.create({ data: { reference, nom, description, unite, seuilAlerte } });
        created++;
      } catch (e: any) {
        if (e?.code === 'P2002') { skipped++; } else { throw e; }
      }
    }
    return { created, skipped, total: created + skipped };
  }

  async seedArticles() {
    const liste = [
      { reference: 'O-KPTO-1FO-25M-R-ECN', nom: 'KIT PTO MONO 25 M (ou 30/35M)' },
      { reference: 'O-KPTO-1FO-40M-R-ECN', nom: 'KIT PTO MONO 40 M (ou 45/50M)' },
      { reference: 'PTO-1FO-R-ECN', nom: 'PTO 1FO' },
      { reference: 'O-C2FO/EXT500-1-FB', nom: 'Câble abonné EXT 2FO (2x 1fo) touret 500m' },
      { reference: 'O-KPTO-2FO-25M-R-ECN', nom: 'KIT PTO BI 25M (ou 30/35M)' },
      { reference: 'O-KPTO-2FO-40M-R-ECN', nom: 'KIT PTO BI 40M (ou 45/50M)' },
      { reference: 'PTO-2FO-R-ECN', nom: 'PTO 2 FO' },
      { reference: 'O-KPTO-4FO-25M-R-ECN', nom: 'KIT PTO QUADRI 25M (ou 30/35M)' },
      { reference: 'O-KPTO-4FO-40M-R-ECN', nom: 'KIT PTO QUADRI 40M (ou 40M)' },
      { reference: 'PTO-4FO-R-ECN', nom: 'PTO 4FO' },
      { reference: 'O-C4FO/EXT500-R-FB', nom: 'Câble abonné EXT 4FO (500M)' },
      { reference: 'JR-SCASCA-3.5-R-ECN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 3,5m' },
      { reference: 'JR-SCASCA-2.5-R-ECN', nom: 'JARRETIERE ROUGE SC/APC G652 2,5M' },
      { reference: 'JR-SCASCA-4-R-ECN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 4m' },
      { reference: 'AC560000-ETC', nom: "Pince d'ancrage (+cable fixation FO diam 6-8mm)" },
      { reference: 'DS4 - 09172', nom: 'Dispositif de suspension câble FO rond 4/6mm' },
      { reference: 'F-SFP01A-0-LR', nom: 'SFP' },
      { reference: 'F-MDONU05A-0-JN', nom: 'ONU' },
      { reference: 'O-PC2_25/U-20-PN', nom: 'CORDONS PRECO 2FO' },
      { reference: 'O-PC2_40/U-20-PN', nom: 'CORDONS PRECO 2FO' },
      { reference: 'O-JT2D/A/1-0-ET', nom: 'JARRETIERE ROUGE SC/APC G652D 1m' },
      { reference: 'MFOA20275', nom: 'KIT ECAM Simple pour câble 3-7mm' },
      { reference: 'MFOA20241', nom: 'Kit ECAM de câble de 4/12 mm' },
      { reference: 'O-EPI100-0-HN', nom: 'EPIBOX' },
      { reference: 'O-CABDEPORT20-R-ECN', nom: 'Câble de déport 3mm DTIO-PTO 20m' },
      { reference: 'O-CABDEPORT40-R-ECN', nom: 'Câble de déport 3mm DTIO-PTO 40m' },
      { reference: '5/14 - 0207', nom: 'Traverse 11 trous' },
      { reference: '5/19 - 0148', nom: 'Traverse 15 trous Appui commun' },
      { reference: 'REFO3 - 91944', nom: 'Réhausse monobloc' },
      { reference: 'IFDB-MDROP-02-FR08', nom: "kits d'arrimage + supports SMOUV.+ collier + mousse (TYCO)" },
      { reference: 'OCADK-S2-S2-NNCS', nom: 'Corps de traverse OC-ADK-S2-S2-NNCS (TYCO)' },
      { reference: 'O-C2FO/INT250-0-TL', nom: 'Câble abonné INT 2FO (2 x 1fo) touret 250m' },
      { reference: 'O-C4FO/INT250-0-TL', nom: 'Câble abonné INT 4FO (1 x 4fo) touret 250m' },
      { reference: 'JR1-SCASCA-4.5-R-ECN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 4,5m' },
      { reference: 'JR-SCASCA-5-R-ECN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 5m' },
      { reference: 'PAT-5.5-DD-B-16-S-R', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 5,5m' },
      { reference: 'JR-SCASCA-6-R-ECN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 6m' },
      { reference: 'O-JTA2/A/6.5-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 6,5m' },
      { reference: 'O-JTA2/A/7-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 7m' },
      { reference: 'O-JTA2/A/7.5-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 7,5m' },
      { reference: 'O-JTA2/A/8-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 8m' },
      { reference: 'PAT-8.5-DD-B-16-S-R', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 8,5m' },
      { reference: 'PAT-9-DD-B-16-S-R', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 9m' },
      { reference: 'PAT-9.5-DD-B-16-S-R', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 9,5m' },
      { reference: 'PAT-10-DD-B-16-S-R', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 10m' },
      { reference: 'PAT-10.5-DD-B-16-S-R', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 10,5m' },
      { reference: 'PAT-11-DD-B-16-S-R', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 11m' },
      { reference: 'PAT-11.5-DD-B-16-S-R', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 11,5m' },
      { reference: 'PAT-12-DD-B-16-S-R', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 12m' },
      { reference: 'JR-LCUSCA-5-R-ECN', nom: 'Cordon simplex SMF G.657A2 gaine 1.6 mm rouge LC/UPC-SC/APC, grade C, 5 m' },
      { reference: 'TENIO-SKG3-5/8', nom: 'Entrée de boîte' },
      { reference: 'OFDC-ISROD-6MM-24', nom: 'Fixations de câble type ISROD pour 1 câble de diam 4 à 6 mm max' },
      { reference: '9979', nom: 'Connecteur montable pour câbles préco 0,9' },
      { reference: 'TENIO-CTU-L-(10)', nom: 'TENIO Arrimage 1 câbles (conditionnement 10 unités)' },
      { reference: 'A-FSA200BA-1-ZN', nom: 'Jarretières UPC-APC FREEBOX (Kit ONU)' },
    ];

    const refs = new Set(liste.map(a => a.reference));
    let upserted = 0;
    let deactivated = 0;

    for (const item of liste) {
      await this.prisma.article.upsert({
        where: { reference: item.reference },
        update: { nom: item.nom, actif: true },
        create: { reference: item.reference, nom: item.nom, unite: 'unité', seuilAlerte: 0, actif: true },
      });
      upserted++;
    }

    // Désactiver les articles hors-liste
    const result = await this.prisma.article.updateMany({
      where: { reference: { notIn: [...refs] } },
      data: { actif: false },
    });
    deactivated = result.count;

    return { upserted, deactivated, total: liste.length };
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
      orderBy: { createdAt: 'asc' },
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
