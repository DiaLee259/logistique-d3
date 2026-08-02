import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { QueryConsommablesDto, UpdateFormuleDto, CreateFormuleDto, AnalyseConsommablesDto } from './dto/query-consommables.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ConsommablesService {
  constructor(private prisma: PrismaService) {}

  async listImports() {
    return this.prisma.importConsommableLog.findMany({
      orderBy: { dateImport: 'desc' },
      select: {
        id: true,
        nomFichier: true,
        dateImport: true,
        nbLignesTotal: true,
        nbLignesImportees: true,
        nbErreurs: true,
        dureeSecondes: true,
        statut: true,
        periodeDebut: true,
        periodeFin: true,
        createdAt: true,
      },
    });
  }

  async listFormules() {
    return this.prisma.formuleConsommable.findMany({
      orderBy: [{ ordre: 'asc' }, { nomProduit: 'asc' }],
    });
  }

  async createFormule(dto: CreateFormuleDto) {
    return this.prisma.formuleConsommable.create({
      data: {
        id: uuidv4(),
        codeArticle: dto.codeArticle,
        nomProduit: dto.nomProduit,
        categorie: dto.categorie ?? null,
        descriptionFormule: dto.descriptionFormule,
        conditionZone: dto.conditionZone ?? null,
        conditionInfra: dto.conditionInfra ?? null,
        conditionInfraMode: dto.conditionInfraMode ?? 'EQ',
        conditionEtat: dto.conditionEtat ?? null,
        conditionActivite: dto.conditionActivite ?? 'PROD',
        conditionTechnologie: dto.conditionTechnologie ?? null,
        conditionTypeAbonne: dto.conditionTypeAbonne ?? null,
        excludePLP: dto.excludePLP ?? false,
        multiplicateur: dto.multiplicateur ?? 1.0,
        multiplicateurNok: dto.multiplicateurNok ?? 0.0,
        minimumQte: dto.minimumQte ?? null,
        ordre: dto.ordre ?? 0,
      },
    });
  }

  async deleteFormule(id: string) {
    return this.prisma.formuleConsommable.delete({ where: { id } });
  }

  async updateFormule(id: string, dto: UpdateFormuleDto) {
    return this.prisma.formuleConsommable.update({
      where: { id },
      data: {
        ...(dto.multiplicateur !== undefined && { multiplicateur: dto.multiplicateur }),
        ...(dto.multiplicateurNok !== undefined && { multiplicateurNok: dto.multiplicateurNok }),
        ...(dto.minimumQte !== undefined && { minimumQte: dto.minimumQte }),
        ...(dto.actif !== undefined && { actif: dto.actif }),
      },
    });
  }

  async getFilters() {
    const [departements, mois, semaines] = await Promise.all([
      this.prisma.$queryRaw<{ code: string; nom: string }[]>`
        SELECT DISTINCT
          "codeDepartement" AS code,
          "departement"     AS nom
        FROM interventions_terrain
        WHERE "codeDepartement" IS NOT NULL
        ORDER BY "codeDepartement"
      `,
      this.prisma.$queryRaw<{ mois: Date }[]>`
        SELECT DISTINCT "moisIntervention" AS mois
        FROM interventions_terrain
        WHERE "moisIntervention" IS NOT NULL
        ORDER BY mois DESC
        LIMIT 36
      `,
      this.prisma.$queryRaw<{ semaine: string }[]>`
        SELECT DISTINCT "semaineIntervention" AS semaine
        FROM interventions_terrain
        WHERE "semaineIntervention" IS NOT NULL
        ORDER BY semaine DESC
        LIMIT 52
      `,
    ]);

    return { departements, mois, semaines };
  }

  async calcul(query: QueryConsommablesDto) {
    const formules = await this.prisma.formuleConsommable.findMany({
      where: { actif: true },
      orderBy: [{ ordre: 'asc' }],
    });

    const results = await Promise.all(
      formules.map(async (f) => {
        const qty = await this._calculerFormule(f, query);
        return {
          codeArticle: f.codeArticle,
          nomProduit: f.nomProduit,
          categorie: f.categorie,
          descriptionFormule: f.descriptionFormule,
          multiplicateur: f.multiplicateur,
          multiplicateurNok: f.multiplicateurNok,
          quantite: qty,
        };
      }),
    );

    return results;
  }

  private async _calculerFormule(
    f: {
      conditionZone: string | null;
      conditionInfra: string | null;
      conditionInfraMode: string;
      conditionEtat: string | null;
      conditionActivite: string;
      conditionTechnologie: string | null;
      conditionTypeAbonne: string | null;
      excludePLP: boolean;
      multiplicateur: number;
      multiplicateurNok: number;
      minimumQte: number | null;
    },
    query: QueryConsommablesDto,
  ): Promise<number> {
    const where: Prisma.InterventionTerrainWhereInput = {};

    if (f.conditionZone) where.typezone = { equals: f.conditionZone, mode: 'insensitive' };
    if (f.conditionActivite !== 'tous') where.activites = { equals: f.conditionActivite, mode: 'insensitive' };
    if (f.conditionTechnologie) where.technologie = { equals: f.conditionTechnologie, mode: 'insensitive' };
    if (f.conditionTypeAbonne) where.typeAbonne = { equals: f.conditionTypeAbonne, mode: 'insensitive' };

    if (f.conditionInfra) {
      if (f.conditionInfraMode === 'NEQ') {
        where.infrastructure = { not: f.conditionInfra };
      } else {
        where.infrastructure = { equals: f.conditionInfra, mode: 'insensitive' };
      }
    }

    if (f.excludePLP) where.typePresta = { not: 'PLP' };

    if (query.codeDepartement) where.codeDepartement = query.codeDepartement;
    if (query.semaineIntervention) where.semaineIntervention = query.semaineIntervention;
    if (query.nomTechnicien) where.nomTechnicien = query.nomTechnicien;
    if (query.nomSociete) where.nomSociete = query.nomSociete;
    if (query.moisDebut || query.moisFin) {
      where.moisIntervention = {};
      if (query.moisDebut) where.moisIntervention.gte = new Date(query.moisDebut);
      if (query.moisFin) where.moisIntervention.lte = new Date(query.moisFin);
    }

    const whereOk = f.conditionEtat
      ? { ...where, etat: { equals: f.conditionEtat, mode: 'insensitive' as const } }
      : where;

    const countOk = await this.prisma.interventionTerrain.count({ where: whereOk });
    let total = countOk * f.multiplicateur;

    if (f.multiplicateurNok > 0) {
      const whereNok = { ...where, etat: { equals: 'NOK', mode: 'insensitive' as const } };
      const countNok = await this.prisma.interventionTerrain.count({ where: whereNok });
      total += countNok * f.multiplicateurNok;
    }

    if (f.minimumQte !== null && f.minimumQte !== undefined) {
      total = Math.max(total, f.minimumQte);
    }

    return Math.round(total);
  }

  async repartition(query: QueryConsommablesDto) {
    const groupBy = query.groupBy ?? 'mois';
    const col = {
      mois: '"moisIntervention"',
      semaine: '"semaineIntervention"',
      departement: '"codeDepartement"',
      technicien: '"nomTechnicien"',
    }[groupBy] ?? '"moisIntervention"';

    const filters: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (query.codeDepartement) {
      filters.push(`"codeDepartement" = $${i++}`);
      params.push(query.codeDepartement);
    }
    if (query.moisDebut) {
      filters.push(`"moisIntervention" >= $${i++}`);
      params.push(new Date(query.moisDebut));
    }
    if (query.moisFin) {
      filters.push(`"moisIntervention" <= $${i++}`);
      params.push(new Date(query.moisFin));
    }
    if (query.semaineIntervention) {
      filters.push(`"semaineIntervention" = $${i++}`);
      params.push(query.semaineIntervention);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const rows = await this.prisma.$queryRawUnsafe<
      { dimension: string; countOk: bigint; countNok: bigint; countTotal: bigint }[]
    >(
      `SELECT
         ${col} AS dimension,
         COUNT(CASE WHEN etat = 'OK' THEN 1 END)  AS "countOk",
         COUNT(CASE WHEN etat = 'NOK' THEN 1 END) AS "countNok",
         COUNT(*)                                  AS "countTotal"
       FROM interventions_terrain
       ${whereClause}
       GROUP BY ${col}
       ORDER BY ${col} DESC
       LIMIT 100`,
      ...params,
    );

    return rows.map((r) => ({
      dimension: r.dimension,
      countOk: Number(r.countOk),
      countNok: Number(r.countNok),
      countTotal: Number(r.countTotal),
    }));
  }

  async analyse(query: AnalyseConsommablesDto) {
    const groupBy = query.groupBy ?? 'departement';

    const dimColMap: Record<string, string> = {
      departement: `COALESCE(departement, 'Inconnu')`,
      mois:         `TO_CHAR("moisIntervention", 'YYYY-MM')`,
      semaine:      `COALESCE("semaineIntervention", 'Inconnu')`,
      operateur:    `COALESCE(operateur, 'Inconnu')`,
      typezone:     `COALESCE(typezone, 'Inconnu')`,
      infrastructure: `COALESCE(infrastructure, 'Inconnu')`,
      typeAbonne:   `COALESCE("typeAbonne", 'Inconnu')`,
      activite:     `COALESCE(activites, 'Inconnu')`,
    };
    const dim = dimColMap[groupBy] ?? `TO_CHAR("moisIntervention", 'YYYY-MM')`;

    const formuleWhere: { actif: boolean; id?: string } = { actif: true };
    if (query.produitId) formuleWhere.id = query.produitId;

    const formules = await this.prisma.formuleConsommable.findMany({
      where: formuleWhere,
      orderBy: [{ ordre: 'asc' }],
    });

    const rows: {
      nomProduit: string;
      codeArticle: string;
      categorie: string | null;
      dimension: string;
      quantiteEstimee: number;
    }[] = [];

    const allDimensionsSet = new Set<string>();

    for (const f of formules) {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let pIdx = 1;

      // conditionEtat → okCond (paramétrisé)
      let okCond: string;
      if (f.conditionEtat) {
        okCond = `LOWER(etat) = LOWER($${pIdx++})`;
        params.push(f.conditionEtat);
      } else {
        okCond = 'TRUE';
      }

      // Conditions formule (valeurs DB, embed safe)
      if (f.conditionZone) {
        conditions.push(`LOWER(typezone) = LOWER('${f.conditionZone.replace(/'/g, "''")}')`);
      }
      if (f.conditionActivite !== 'tous') {
        conditions.push(`LOWER(activites) = LOWER('${f.conditionActivite.replace(/'/g, "''")}')`);
      }
      if (f.conditionTechnologie) {
        conditions.push(`LOWER(technologie) = LOWER('${f.conditionTechnologie.replace(/'/g, "''")}')`);
      }
      if (f.conditionTypeAbonne) {
        conditions.push(`LOWER("typeAbonne") = LOWER('${f.conditionTypeAbonne.replace(/'/g, "''")}')`);
      }
      if (f.conditionInfra) {
        const op = f.conditionInfraMode === 'NEQ' ? '<>' : '=';
        conditions.push(`LOWER(infrastructure) ${op} LOWER('${f.conditionInfra.replace(/'/g, "''")}')`);
      }
      if (f.excludePLP) {
        conditions.push(`"typePresta" <> 'PLP'`);
      }

      // Filtres query (paramétrisés)
      if (query.codeDepartement) {
        conditions.push(`"codeDepartement" = $${pIdx++}`);
        params.push(query.codeDepartement);
      }
      if (query.operateur) {
        conditions.push(`LOWER(operateur) = LOWER($${pIdx++})`);
        params.push(query.operateur);
      }
      if (query.moisDebut) {
        conditions.push(`"moisIntervention" >= $${pIdx++}`);
        params.push(new Date(query.moisDebut));
      }
      if (query.moisFin) {
        conditions.push(`"moisIntervention" <= $${pIdx++}`);
        params.push(new Date(query.moisFin));
      }

      const whereStr = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const multOkIdx = pIdx++;
      const multNokIdx = pIdx++;
      params.push(f.multiplicateur);
      params.push(f.multiplicateurNok);

      const sql = `
        WITH base AS (
          SELECT
            ${dim} AS dimension,
            SUM(CASE WHEN (${okCond}) THEN 1.0 ELSE 0 END) AS cnt_ok,
            SUM(CASE WHEN LOWER(etat) = 'nok' THEN 1.0 ELSE 0 END) AS cnt_nok
          FROM interventions_terrain
          ${whereStr}
          GROUP BY ${dim}
        )
        SELECT dimension, ROUND(cnt_ok * $${multOkIdx}::float8 + cnt_nok * $${multNokIdx}::float8) AS "quantiteEstimee"
        FROM base
        WHERE cnt_ok * $${multOkIdx}::float8 + cnt_nok * $${multNokIdx}::float8 > 0
        ORDER BY dimension
      `;

      const result = await this.prisma.$queryRawUnsafe<{ dimension: string; quantiteEstimee: bigint }[]>(
        sql,
        ...params,
      );

      for (const r of result) {
        if (r.dimension !== null) {
          allDimensionsSet.add(r.dimension);
          rows.push({
            nomProduit: f.nomProduit,
            codeArticle: f.codeArticle,
            categorie: f.categorie,
            dimension: r.dimension,
            quantiteEstimee: Number(r.quantiteEstimee),
          });
        }
      }
    }

    return {
      rows,
      formules: formules.map(f => ({
        id: f.id,
        nomProduit: f.nomProduit,
        codeArticle: f.codeArticle,
        categorie: f.categorie,
      })),
      dimensions: [...allDimensionsSet].sort(),
    };
  }

  async commandesByArticle(moisDebut?: string, moisFin?: string) {
    const conditions = [`c."deletedAt" IS NULL`];
    const params: unknown[] = [];
    let pIdx = 1;

    if (moisDebut) {
      conditions.push(`DATE_TRUNC('month', c."createdAt") >= $${pIdx++}::timestamp`);
      params.push(new Date(moisDebut));
    }
    if (moisFin) {
      conditions.push(`DATE_TRUNC('month', c."createdAt") <= $${pIdx++}::timestamp`);
      params.push(new Date(moisFin));
    }

    const whereStr = `WHERE ${conditions.join(' AND ')}`;

    const result = await this.prisma.$queryRawUnsafe<{
      codeArticle: string;
      nomArticle: string;
      mois: string;
      quantiteCommandee: bigint;
    }[]>(`
      SELECT
        a.reference                                              AS "codeArticle",
        a.nom                                                   AS "nomArticle",
        TO_CHAR(DATE_TRUNC('month', c."createdAt"), 'YYYY-MM') AS mois,
        SUM(lc."quantiteDemandee")::bigint                     AS "quantiteCommandee"
      FROM lignes_commande lc
      JOIN articles a  ON a.id = lc."articleId"
      JOIN commandes c ON c.id = lc."commandeId"
      ${whereStr}
        AND a.reference IN (
          SELECT "codeArticle" FROM formules_consommable WHERE actif = true
        )
      GROUP BY a.reference, a.nom, DATE_TRUNC('month', c."createdAt")
      ORDER BY a.reference, DATE_TRUNC('month', c."createdAt")
    `, ...params);

    return result.map(r => ({
      codeArticle: r.codeArticle,
      nomArticle: r.nomArticle,
      mois: r.mois,
      quantiteCommandee: Number(r.quantiteCommandee),
    }));
  }

  async summary() {
    const [totaux, dernierImport] = await Promise.all([
      this.prisma.$queryRaw<
        { countTotal: bigint; countOk: bigint; countNok: bigint; countProd: bigint; countSav: bigint }[]
      >`
        SELECT
          COUNT(*)                                     AS "countTotal",
          COUNT(CASE WHEN etat = 'OK' THEN 1 END)      AS "countOk",
          COUNT(CASE WHEN etat = 'NOK' THEN 1 END)     AS "countNok",
          COUNT(CASE WHEN activites = 'PROD' THEN 1 END) AS "countProd",
          COUNT(CASE WHEN activites = 'SAV' THEN 1 END)  AS "countSav"
        FROM interventions_terrain
      `,
      this.prisma.importConsommableLog.findFirst({
        orderBy: { dateImport: 'desc' },
        where: { statut: 'SUCCES' },
        select: { dateImport: true, nomFichier: true, nbLignesImportees: true },
      }),
    ]);

    const t = totaux[0];
    return {
      countTotal: Number(t.countTotal),
      countOk: Number(t.countOk),
      countNok: Number(t.countNok),
      countProd: Number(t.countProd),
      countSav: Number(t.countSav),
      tauxOk: t.countTotal > 0n
        ? Math.round((Number(t.countOk) / Number(t.countTotal)) * 100)
        : 0,
      dernierImport,
    };
  }
}
