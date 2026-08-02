-- Référentiel techniciens — permet d'enrichir les imports interventions
-- dont les colonnes nomTechnicien / nomSociete sont vides dans l'Excel source.

CREATE TABLE "techniciens_ref" (
  "id"            TEXT NOT NULL,
  "idCas"         BIGINT NOT NULL,
  "nomTechnicien" TEXT NOT NULL,
  "nomSociete"    TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "techniciens_ref_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "techniciens_ref_idCas_key" ON "techniciens_ref"("idCas");

-- Statut EN_COURS pour les imports asynchrones
-- (les anciens imports restent SUCCES / ECHEC / PARTIEL)
