-- Add missing guardrail configuration columns to TenantConfig
ALTER TABLE "TenantConfig"
  ADD COLUMN IF NOT EXISTS "preset" TEXT,
  ADD COLUMN IF NOT EXISTS "llm" JSONB;
