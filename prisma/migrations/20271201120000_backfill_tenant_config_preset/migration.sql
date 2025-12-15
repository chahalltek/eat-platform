-- Ensure tenant config columns exist for guardrail presets and learning settings
ALTER TABLE "TenantConfig"
  ADD COLUMN IF NOT EXISTS "preset" TEXT,
  ADD COLUMN IF NOT EXISTS "llm" JSONB,
  ADD COLUMN IF NOT EXISTS "networkLearningOptIn" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "networkLearning" JSONB;
