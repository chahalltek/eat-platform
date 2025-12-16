-- Ensure TenantConfig columns exist for network learning toggles
ALTER TABLE "TenantConfig"
  ADD COLUMN IF NOT EXISTS "networkLearningOptIn" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "networkLearning" JSONB;
