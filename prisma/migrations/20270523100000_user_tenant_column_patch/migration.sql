-- Ensure User table has tenantId and displayName columns so auth queries succeed
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "displayName" TEXT;

-- Backfill displayName where missing
UPDATE "User"
SET "displayName" = COALESCE("displayName", "name", "email")
WHERE "displayName" IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE "User" ALTER COLUMN "displayName" SET NOT NULL;

-- Recreate composite unique/indexes for multi-tenant lookups if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE tablename = 'User' AND indexname = 'User_tenantId_email_key'
    ) THEN
        CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE tablename = 'User' AND indexname = 'User_tenantId_idx'
    ) THEN
        CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
    END IF;
END $$;
