-- Ensure User table has tenantId and displayName columns for Prisma schema compatibility
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default-tenant';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "displayName" TEXT;

-- Backfill displayName from legacy columns where available
DO $$
DECLARE
    name_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = ANY (current_schemas(false))
          AND table_name = 'User'
          AND column_name = 'name'
    ) INTO name_exists;

    IF name_exists THEN
        EXECUTE 'UPDATE "User" SET "displayName" = COALESCE("displayName", "name", "email")';
    ELSE
        EXECUTE 'UPDATE "User" SET "displayName" = COALESCE("displayName", "email")';
    END IF;
END $$;
ALTER TABLE "User" ALTER COLUMN "displayName" SET NOT NULL;

-- Recreate tenant/email uniqueness if it is missing
DO $$
DECLARE
    constraint_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'User'
          AND c.conname = 'User_email_key'
    ) INTO constraint_exists;

    IF constraint_exists THEN
        EXECUTE 'ALTER TABLE "User" DROP CONSTRAINT "User_email_key"';
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "User_tenantId_email_key" ON "User"("tenantId", "email");
CREATE INDEX IF NOT EXISTS "User_tenantId_idx" ON "User"("tenantId");
