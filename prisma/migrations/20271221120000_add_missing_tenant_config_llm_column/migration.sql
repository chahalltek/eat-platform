-- Add missing guardrail columns to TenantConfig to avoid schema mismatches
ALTER TABLE "TenantConfig"
  ADD COLUMN IF NOT EXISTS "llm" JSONB,
  ADD COLUMN IF NOT EXISTS "networkLearningOptIn" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "networkLearning" JSONB;
