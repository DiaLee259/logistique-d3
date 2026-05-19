-- Ajout du champ transfertId pour lier les paires SORTIE↔ENTREE d'un transfert inter-entrepôt
ALTER TABLE "mouvements" ADD COLUMN "transfertId" TEXT;
