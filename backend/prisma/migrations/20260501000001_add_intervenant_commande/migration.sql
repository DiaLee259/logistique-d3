ALTER TABLE "intervenants" ADD COLUMN IF NOT EXISTS "autoEntrepreneur" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "commandes" ADD COLUMN IF NOT EXISTS "intervenantId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commandes_intervenantId_fkey') THEN
    ALTER TABLE "commandes" ADD CONSTRAINT "commandes_intervenantId_fkey"
      FOREIGN KEY ("intervenantId") REFERENCES "intervenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
