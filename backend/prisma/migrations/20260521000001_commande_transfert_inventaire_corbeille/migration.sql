-- Commande : type de commande + entrepôt destination (pour les transferts internes)
ALTER TABLE "commandes" ADD COLUMN IF NOT EXISTS "typeCommande" TEXT DEFAULT 'STANDARD';
ALTER TABLE "commandes" ADD COLUMN IF NOT EXISTS "entrepotDestinationId" TEXT;

-- InventairePhysique : soft delete
ALTER TABLE "inventaires_physiques" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "inventaires_physiques" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;
ALTER TABLE "inventaires_physiques" ADD COLUMN IF NOT EXISTS "deletedByName" TEXT;
