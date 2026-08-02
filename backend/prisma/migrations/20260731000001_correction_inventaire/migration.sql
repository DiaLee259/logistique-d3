-- Corrections d'inventaire : traçabilité des modifications de quantité sur un inventaire existant
CREATE TABLE "corrections_inventaire" (
  "id"              TEXT NOT NULL,
  "inventaireId"    TEXT NOT NULL,
  "quantiteAvant"   INTEGER NOT NULL,
  "quantiteApres"   INTEGER NOT NULL,
  "commentaire"     TEXT NOT NULL,
  "correctedById"   TEXT,
  "correctedByName" TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "corrections_inventaire_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "corrections_inventaire"
  ADD CONSTRAINT "corrections_inventaire_inventaireId_fkey"
  FOREIGN KEY ("inventaireId") REFERENCES "inventaires_physiques"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
