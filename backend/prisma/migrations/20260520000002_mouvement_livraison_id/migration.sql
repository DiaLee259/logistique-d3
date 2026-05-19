-- Lien entre un mouvement et la livraison qui l'a généré (nullable, rétrocompatible)
ALTER TABLE "mouvements" ADD COLUMN IF NOT EXISTS "livraisonId" TEXT;

ALTER TABLE "mouvements" ADD CONSTRAINT "mouvements_livraisonId_fkey"
  FOREIGN KEY ("livraisonId") REFERENCES "livraisons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
