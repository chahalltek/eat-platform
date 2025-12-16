-- CreateEnum (if missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TenantDeletionMode') THEN
    CREATE TYPE "TenantDeletionMode" AS ENUM ('SOFT_DELETE', 'HARD_DELETE');
  END IF;
END$$;

-- Add deletionMode to Tenant (if missing)
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "deletionMode" "TenantDeletionMode" NOT NULL DEFAULT 'SOFT_DELETE';

-- CreateTable SecurityEventLog (if missing)
CREATE TABLE IF NOT EXISTS "SecurityEventLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'default-tenant',
  "userId" TEXT,
  "eventType" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityEventLog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "SecurityEventLog_tenantId_idx" ON "SecurityEventLog"("tenantId");
CREATE INDEX IF NOT EXISTS "SecurityEventLog_tenantId_eventType_idx" ON "SecurityEventLog"("tenantId", "eventType");

-- Optional FK to User (Prisma expects relation, but adding FK is safest if User exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'User') THEN
    -- only add constraint if it doesn't already exist
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'SecurityEventLog_userId_fkey'
    ) THEN
      ALTER TABLE "SecurityEventLog"
        ADD CONSTRAINT "SecurityEventLog_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END$$;
