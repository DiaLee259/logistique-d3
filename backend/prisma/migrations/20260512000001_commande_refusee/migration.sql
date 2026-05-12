-- AlterEnum: add REFUSEE to StatutCommande
ALTER TYPE "StatutCommande" ADD VALUE 'REFUSEE';

-- AlterTable: add commentaireRefus column
ALTER TABLE "commandes" ADD COLUMN "commentaireRefus" TEXT;
