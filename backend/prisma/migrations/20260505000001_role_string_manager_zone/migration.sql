-- Convert Role enum column to TEXT and drop the enum type
ALTER TABLE "users" ALTER COLUMN "role" TYPE TEXT USING "role"::TEXT;
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'LOGISTICIEN_2';
DROP TYPE IF EXISTS "Role";
