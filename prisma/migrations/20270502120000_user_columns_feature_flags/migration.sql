-- Ensure User table has tenantId and displayName columns so admin pages (feature flags, etc.) work reliably
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "displayName" TEXT;

-- Backfill missing tenantId/displayName values from legacy fields if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'tenantId') THEN
    UPDATE "User"
    SET "tenantId" = COALESCE("tenantId", 'default-tenant')
    WHERE "tenantId" IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'displayName') THEN
    UPDATE "User"
    SET "displayName" = COALESCE("displayName", "name", "email")
    WHERE "displayName" IS NULL;
  END IF;
END $$;

-- Enforce NOT NULL constraints when data is present
ALTER TABLE "User" ALTER COLUMN "tenantId" SET DEFAULT 'default-tenant';
ALTER TABLE "User" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "displayName" SET NOT NULL;

-- Maintain indexes/uniques used by the application
CREATE UNIQUE INDEX IF NOT EXISTS "User_tenantId_email_key" ON "User"("tenantId", "email");
CREATE INDEX IF NOT EXISTS "User_tenantId_idx" ON "User"("tenantId");
