-- Usage metering and tenant config enhancements

-- Add missing tenant config columns for presets and network learning
ALTER TABLE "TenantConfig"
ADD COLUMN IF NOT EXISTS "preset" TEXT,
ADD COLUMN IF NOT EXISTS "llm" JSONB,
ADD COLUMN IF NOT EXISTS "networkLearningOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "networkLearning" JSONB;

-- Usage event enum to capture metering dimensions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UsageEventType') THEN
    CREATE TYPE "UsageEventType" AS ENUM ('JOBS_PROCESSED', 'CANDIDATES_EVALUATED', 'AGENT_RUN', 'EXPLAIN_CALL', 'COPILOT_CALL');
  END IF;
END;
$$;

-- Usage events table for reporting-only metering
CREATE TABLE IF NOT EXISTS "UsageEvent" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL DEFAULT 'default-tenant',
  "eventType" "UsageEventType" NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Helpful indexes for monthly rollups
CREATE INDEX IF NOT EXISTS "UsageEvent_tenantId_occurredAt_idx" ON "UsageEvent"("tenantId", "occurredAt");
CREATE INDEX IF NOT EXISTS "UsageEvent_tenantId_eventType_occurredAt_idx" ON "UsageEvent"("tenantId", "eventType", "occurredAt");
