-- User.managerZoneId (liaison optionnelle vers un manager de zone)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "managerZoneId" TEXT;

ALTER TABLE "users" ADD CONSTRAINT "users_managerZoneId_fkey"
  FOREIGN KEY ("managerZoneId") REFERENCES "managers_zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
