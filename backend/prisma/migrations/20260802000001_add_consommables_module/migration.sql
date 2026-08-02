-- Module Consommables Terrain
-- Trois nouvelles tables pour l'analyse de consommation à partir des interventions TECHNO SMART

-- Historique des imports Excel
CREATE TABLE "imports_consommable_log" (
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
);

-- Interventions terrain importées depuis Excel (424k lignes)
CREATE TABLE "interventions_terrain" (
  "id"                    TEXT NOT NULL,
  "idInterventionIw"      BIGINT,
  "idInterventionGrdv"    BIGINT,
  "idTechnicienCas"       BIGINT,
  "nomTechnicien"         TEXT,
  "nomSociete"            TEXT,
  "codeDepartement"       TEXT,
  "departement"           TEXT,
  "dateIntervention"      TIMESTAMP(3),
  "moisIntervention"      TIMESTAMP(3),
  "semaineIntervention"   TEXT,
  "technologie"           TEXT,
  "infrastructure"        TEXT,
  "operateur"             TEXT,
  "typeAbonne"            TEXT,
  "modeleModem"           TEXT,
  "typezone"              TEXT,
  "activites"             TEXT,
  "typePresta"            TEXT,
  "etat"                  TEXT,
  "codeCloture"           TEXT,
  "categorieEchec"        TEXT,
  "aboRacco110"           TEXT,
  "aboRacco120"           TEXT,
  "sourceImportId"        TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "interventions_terrain_pkey" PRIMARY KEY ("id")
);

-- Index pour les requêtes de calcul (COUNTIFS-équivalents)
CREATE INDEX "interventions_terrain_typezone_activites_etat_idx"
  ON "interventions_terrain"("typezone", "activites", "etat");

CREATE INDEX "interventions_terrain_typezone_activites_etat_infrastructure_idx"
  ON "interventions_terrain"("typezone", "activites", "etat", "infrastructure");

CREATE INDEX "interventions_terrain_technologie_activites_typeAbonne_etat_idx"
  ON "interventions_terrain"("technologie", "activites", "typeAbonne", "etat");

CREATE INDEX "interventions_terrain_codeDepartement_idx"
  ON "interventions_terrain"("codeDepartement");

CREATE INDEX "interventions_terrain_moisIntervention_idx"
  ON "interventions_terrain"("moisIntervention");

CREATE INDEX "interventions_terrain_semaineIntervention_idx"
  ON "interventions_terrain"("semaineIntervention");

CREATE INDEX "interventions_terrain_nomTechnicien_idx"
  ON "interventions_terrain"("nomTechnicien");

CREATE INDEX "interventions_terrain_nomSociete_idx"
  ON "interventions_terrain"("nomSociete");

CREATE INDEX "interventions_terrain_sourceImportId_idx"
  ON "interventions_terrain"("sourceImportId");

-- FK vers l'import
ALTER TABLE "interventions_terrain"
  ADD CONSTRAINT "interventions_terrain_sourceImportId_fkey"
  FOREIGN KEY ("sourceImportId") REFERENCES "imports_consommable_log"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Formules de calcul des consommables (coefficients éditables)
CREATE TABLE "formules_consommable" (
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
);

CREATE UNIQUE INDEX "formules_consommable_codeArticle_key"
  ON "formules_consommable"("codeArticle");
