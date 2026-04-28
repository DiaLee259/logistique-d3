-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'LOGISTICIEN_1', 'LOGISTICIEN_2', 'CHEF_PROJET');

-- CreateEnum
CREATE TYPE "TypeMouvement" AS ENUM ('ENTREE', 'SORTIE');

-- CreateEnum
CREATE TYPE "StatutCommande" AS ENUM ('EN_ATTENTE', 'EN_VALIDATION', 'VALIDEE', 'EXPEDIEE', 'LIVREE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutLivraison" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'LIVREE', 'INCIDENT');

-- CreateEnum
CREATE TYPE "ProdSav" AS ENUM ('PROD', 'SAV', 'AUTRE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'LOGISTICIEN_2',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entrepots" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "localisation" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entrepots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "unite" TEXT NOT NULL DEFAULT 'unité',
    "seuilAlerte" INTEGER NOT NULL DEFAULT 10,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "regleConsommation" TEXT,
    "facteurConsommation" DOUBLE PRECISION,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocks" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "entrepotId" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mouvements" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "articleId" TEXT NOT NULL,
    "entrepotId" TEXT NOT NULL,
    "type" "TypeMouvement" NOT NULL,
    "quantiteDemandee" INTEGER NOT NULL,
    "quantiteFournie" INTEGER NOT NULL,
    "departement" TEXT,
    "numeroCommande" TEXT,
    "numeroOperation" TEXT,
    "sourceDestination" TEXT,
    "prodSav" "ProdSav" NOT NULL DEFAULT 'PROD',
    "commentaire" TEXT,
    "adresseMail" TEXT,
    "manager" TEXT,
    "infoSupplementaire" TEXT,
    "adresse" TEXT,
    "cout" DOUBLE PRECISION,
    "envoye" BOOLEAN NOT NULL DEFAULT false,
    "recu" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "commandeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mouvements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commandes" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "dateReception" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateCommande" TIMESTAMP(3),
    "departement" TEXT NOT NULL,
    "demandeur" TEXT,
    "emailDemandeur" TEXT,
    "manager" TEXT,
    "nombreGrilles" INTEGER,
    "statut" "StatutCommande" NOT NULL DEFAULT 'EN_ATTENTE',
    "commentaire" TEXT,
    "fichierExcelUrl" TEXT,
    "fichierPerceptionUrl" TEXT,
    "bonRetourUrl" TEXT,
    "emailEnvoye" BOOLEAN NOT NULL DEFAULT false,
    "dateEmailEnvoye" TIMESTAMP(3),
    "bonRetourRecu" BOOLEAN NOT NULL DEFAULT false,
    "dateBonRetourRecu" TIMESTAMP(3),
    "valideurId" TEXT,
    "expediteurId" TEXT,
    "dateValidation" TIMESTAMP(3),
    "dateExpedition" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commandes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_commande" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "quantiteDemandee" INTEGER NOT NULL,
    "quantiteValidee" INTEGER,
    "quantiteFournie" INTEGER,
    "commentaire" TEXT,
    "stockDisponible" INTEGER,

    CONSTRAINT "lignes_commande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "livraisons" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "dateLivraison" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fournisseur" TEXT NOT NULL,
    "entrepotId" TEXT NOT NULL,
    "statut" "StatutLivraison" NOT NULL DEFAULT 'EN_ATTENTE',
    "bonLivraisonUrl" TEXT,
    "bonCommandeUrl" TEXT,
    "commentaire" TEXT,
    "commandeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "livraisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_livraison" (
    "id" TEXT NOT NULL,
    "livraisonId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "quantiteCommandee" INTEGER NOT NULL,
    "quantiteRecue" INTEGER NOT NULL,
    "commentaire" TEXT,

    CONSTRAINT "lignes_livraison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consommations" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "articleId" TEXT NOT NULL,
    "departement" TEXT,
    "quantiteTheorique" DOUBLE PRECISION NOT NULL,
    "quantiteReelle" DOUBLE PRECISION NOT NULL,
    "ecart" DOUBLE PRECISION NOT NULL,
    "nombreInterventions" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consommations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventaires_physiques" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "entrepotId" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "commentaire" TEXT,

    CONSTRAINT "inventaires_physiques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "lue" BOOLEAN NOT NULL DEFAULT false,
    "lien" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "entrepots_code_key" ON "entrepots"("code");

-- CreateIndex
CREATE UNIQUE INDEX "articles_reference_key" ON "articles"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "stocks_articleId_entrepotId_key" ON "stocks"("articleId", "entrepotId");

-- CreateIndex
CREATE UNIQUE INDEX "commandes_numero_key" ON "commandes"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "livraisons_numero_key" ON "livraisons"("numero");

-- AddForeignKey
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_entrepotId_fkey" FOREIGN KEY ("entrepotId") REFERENCES "entrepots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements" ADD CONSTRAINT "mouvements_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements" ADD CONSTRAINT "mouvements_entrepotId_fkey" FOREIGN KEY ("entrepotId") REFERENCES "entrepots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements" ADD CONSTRAINT "mouvements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements" ADD CONSTRAINT "mouvements_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "commandes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_valideurId_fkey" FOREIGN KEY ("valideurId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_expediteurId_fkey" FOREIGN KEY ("expediteurId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_commande" ADD CONSTRAINT "lignes_commande_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "commandes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_commande" ADD CONSTRAINT "lignes_commande_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "livraisons" ADD CONSTRAINT "livraisons_entrepotId_fkey" FOREIGN KEY ("entrepotId") REFERENCES "entrepots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "livraisons" ADD CONSTRAINT "livraisons_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "commandes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_livraison" ADD CONSTRAINT "lignes_livraison_livraisonId_fkey" FOREIGN KEY ("livraisonId") REFERENCES "livraisons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_livraison" ADD CONSTRAINT "lignes_livraison_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consommations" ADD CONSTRAINT "consommations_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventaires_physiques" ADD CONSTRAINT "inventaires_physiques_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
