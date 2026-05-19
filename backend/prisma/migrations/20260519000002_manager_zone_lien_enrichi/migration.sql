-- ManagerZone
CREATE TABLE IF NOT EXISTS "managers_zone" (
  "id" TEXT NOT NULL,
  "nom" TEXT NOT NULL,
  "departements" JSONB NOT NULL DEFAULT '[]',
  "actif" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "managers_zone_pkey" PRIMARY KEY ("id")
);

-- LienPrestataire nouveaux champs
ALTER TABLE "liens_prestataire" ADD COLUMN IF NOT EXISTS "managerZoneId" TEXT;
ALTER TABLE "liens_prestataire" ADD COLUMN IF NOT EXISTS "typePrestataire" TEXT;
ALTER TABLE "liens_prestataire" ADD COLUMN IF NOT EXISTS "departementsActifs" TEXT[] NOT NULL DEFAULT '{}';

-- Commande nouveaux champs
ALTER TABLE "commandes" ADD COLUMN IF NOT EXISTS "lienId" TEXT;
ALTER TABLE "commandes" ADD COLUMN IF NOT EXISTS "typePrestataire" TEXT;

-- FK
ALTER TABLE "liens_prestataire" ADD CONSTRAINT "liens_prestataire_managerZoneId_fkey"
  FOREIGN KEY ("managerZoneId") REFERENCES "managers_zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commandes" ADD CONSTRAINT "commandes_lienId_fkey"
  FOREIGN KEY ("lienId") REFERENCES "liens_prestataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;
