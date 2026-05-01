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

      // Colonne quantiteValidee sur mouvements
      await this.$executeRaw`ALTER TABLE "mouvements" ADD COLUMN IF NOT EXISTS "quantiteValidee" INTEGER`;

      this.logger.log('Tables societes/intervenants + colonnes vérifiées ✓');
    } catch (err: any) {
      this.logger.warn(`ensureTables: ${err?.message ?? err}`);
    }
  }
}
