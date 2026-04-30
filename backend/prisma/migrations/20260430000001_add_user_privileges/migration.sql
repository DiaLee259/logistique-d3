-- AlterTable: add privileges JSON column to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "privileges" JSONB;
