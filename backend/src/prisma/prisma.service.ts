import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    await this.ensureTables();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Crée les tables manquantes si elles n'existent pas encore.
   * Idempotent — sans danger si les tables existent déjà.
   * Contourne les cas où prisma migrate deploy n'est pas exécuté au démarrage.
   */
  private async ensureTables() {
    try {
      await this.$executeRaw`
        CREATE TABLE IF NOT EXISTS "societes" (
          "id"        TEXT        NOT NULL,
          "nom"       TEXT        NOT NULL,
          "code"      TEXT,
          "adresse"   TEXT,
          "telephone" TEXT,
          "email"     TEXT,
          "actif"     BOOLEAN     NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "societes_pkey" PRIMARY KEY ("id")
        )
      `;

      await this.$executeRaw`
        CREATE UNIQUE INDEX IF NOT EXISTS "societes_code_key" ON "societes"("code")
      `;

      await this.$executeRaw`
        CREATE TABLE IF NOT EXISTS "intervenants" (
          "id"        TEXT        NOT NULL,
          "nom"       TEXT        NOT NULL,
          "prenom"    TEXT        NOT NULL,
          "email"     TEXT,
          "telephone" TEXT,
          "societeId" TEXT,
          "actif"     BOOLEAN     NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "intervenants_pkey" PRIMARY KEY ("id")
        )
      `;

      await this.$executeRaw`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'intervenants_societeId_fkey'
          ) THEN
            ALTER TABLE "intervenants"
              ADD CONSTRAINT "intervenants_societeId_fkey"
              FOREIGN KEY ("societeId") REFERENCES "societes"("id")
              ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
        END $$
      `;

      // Colonne privileges sur users
      await this.$executeRaw`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "privileges" JSONB
      `;

      // Colonne autoEntrepreneur sur intervenants
      await this.$executeRaw`ALTER TABLE "intervenants" ADD COLUMN IF NOT EXISTS "autoEntrepreneur" BOOLEAN NOT NULL DEFAULT false`;

      // Colonne intervenantId sur commandes + FK
      await this.$executeRaw`ALTER TABLE "commandes" ADD COLUMN IF NOT EXISTS "intervenantId" TEXT`;

      await this.$executeRaw`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commandes_intervenantId_fkey') THEN
            ALTER TABLE "commandes" ADD CONSTRAINT "commandes_intervenantId_fkey"
              FOREIGN KEY ("intervenantId") REFERENCES "intervenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
        END $$
      `;

      // Colonnes entrepotSource
      await this.$executeRaw`ALTER TABLE "lignes_commande" ADD COLUMN IF NOT EXISTS "entrepotSource" TEXT`;
      await this.$executeRaw`ALTER TABLE "commandes" ADD COLUMN IF NOT EXISTS "entrepotSource" TEXT`;

      // Colonnes quantiteValidee + manager sur mouvements
      await this.$executeRaw`ALTER TABLE "mouvements" ADD COLUMN IF NOT EXISTS "quantiteValidee" INTEGER`;
      await this.$executeRaw`ALTER TABLE "mouvements" ADD COLUMN IF NOT EXISTS "manager" TEXT`;

      // ── Corrections d'inventaire ─────────────────────────────────────────────
      await this.$executeRaw`
        CREATE TABLE IF NOT EXISTS "corrections_inventaire" (
          "id"              TEXT NOT NULL,
          "inventaireId"    TEXT NOT NULL,
          "quantiteAvant"   INTEGER NOT NULL,
          "quantiteApres"   INTEGER NOT NULL,
          "commentaire"     TEXT NOT NULL,
          "correctedById"   TEXT,
          "correctedByName" TEXT NOT NULL,
          "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "corrections_inventaire_pkey" PRIMARY KEY ("id")
        )
      `;

      await this.$executeRaw`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'corrections_inventaire_inventaireId_fkey') THEN
            ALTER TABLE "corrections_inventaire"
              ADD CONSTRAINT "corrections_inventaire_inventaireId_fkey"
              FOREIGN KEY ("inventaireId") REFERENCES "inventaires_physiques"("id")
              ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$
      `;

      // ── Consommables Terrain ──────────────────────────────────────────────────
      await this.$executeRaw`
        CREATE TABLE IF NOT EXISTS "imports_consommable_log" (
          "id"                TEXT NOT NULL,
          "nomFichier"        TEXT NOT NULL,
          "dateImport"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "nbLignesTotal"     INTEGER NOT NULL DEFAULT 0,
          "nbLignesImportees" INTEGER NOT NULL DEFAULT 0,
          "nbErreurs"         INTEGER NOT NULL DEFAULT 0,
          "dureeSecondes"     DOUBLE PRECISION,
          "statut"            TEXT NOT NULL,
          "erreurs"           JSONB,
          "periodeDebut"      TIMESTAMP(3),
          "periodeFin"        TIMESTAMP(3),
          "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "imports_consommable_log_pkey" PRIMARY KEY ("id")
        )
      `;

      await this.$executeRaw`
        CREATE TABLE IF NOT EXISTS "interventions_terrain" (
          "id"                  TEXT NOT NULL,
          "idInterventionIw"    BIGINT,
          "idInterventionGrdv"  BIGINT,
          "idTechnicienCas"     BIGINT,
          "nomTechnicien"       TEXT,
          "nomSociete"          TEXT,
          "codeDepartement"     TEXT,
          "departement"         TEXT,
          "dateIntervention"    TIMESTAMP(3),
          "moisIntervention"    TIMESTAMP(3),
          "semaineIntervention" TEXT,
          "technologie"         TEXT,
          "infrastructure"      TEXT,
          "operateur"           TEXT,
          "typeAbonne"          TEXT,
          "modeleModem"         TEXT,
          "typezone"            TEXT,
          "activites"           TEXT,
          "typePresta"          TEXT,
          "etat"                TEXT,
          "codeCloture"         TEXT,
          "categorieEchec"      TEXT,
          "aboRacco110"         TEXT,
          "aboRacco120"         TEXT,
          "sourceImportId"      TEXT,
          "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "interventions_terrain_pkey" PRIMARY KEY ("id")
        )
      `;

      await this.$executeRaw`
        CREATE TABLE IF NOT EXISTS "formules_consommable" (
          "id"                   TEXT NOT NULL,
          "ordre"                INTEGER NOT NULL DEFAULT 0,
          "actif"                BOOLEAN NOT NULL DEFAULT true,
          "codeArticle"          TEXT NOT NULL,
          "nomProduit"           TEXT NOT NULL,
          "categorie"            TEXT,
          "descriptionFormule"   TEXT NOT NULL,
          "conditionZone"        TEXT,
          "conditionInfra"       TEXT,
          "conditionInfraMode"   TEXT NOT NULL DEFAULT 'EQ',
          "conditionEtat"        TEXT,
          "conditionActivite"    TEXT NOT NULL DEFAULT 'PROD',
          "conditionTechnologie" TEXT,
          "conditionTypeAbonne"  TEXT,
          "excludePLP"           BOOLEAN NOT NULL DEFAULT false,
          "multiplicateur"       DOUBLE PRECISION NOT NULL DEFAULT 1.0,
          "multiplicateurNok"    DOUBLE PRECISION NOT NULL DEFAULT 0.0,
          "minimumQte"           INTEGER,
          "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "formules_consommable_pkey" PRIMARY KEY ("id")
        )
      `;

      await this.$executeRaw`
        CREATE UNIQUE INDEX IF NOT EXISTS "formules_consommable_codeArticle_key"
          ON "formules_consommable"("codeArticle")
      `;

      await this.$executeRaw`
        CREATE TABLE IF NOT EXISTS "techniciens_ref" (
          "id"            TEXT NOT NULL,
          "idCas"         BIGINT NOT NULL,
          "nomTechnicien" TEXT NOT NULL,
          "nomSociete"    TEXT,
          "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "techniciens_ref_pkey" PRIMARY KEY ("id")
        )
      `;

      await this.$executeRaw`
        CREATE UNIQUE INDEX IF NOT EXISTS "techniciens_ref_idCas_key" ON "techniciens_ref"("idCas")
      `;

      this.logger.log('Tables societes/intervenants/consommables + colonnes vérifiées ✓');
    } catch (err: any) {
      this.logger.warn(`ensureTables: ${err?.message ?? err}`);
    }
  }
}
