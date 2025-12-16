-- Ensure TenantConfig has network learning settings
ALTER TABLE "TenantConfig"
  ADD COLUMN IF NOT EXISTS "networkLearningOptIn" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "networkLearning" JSONB;

-- Backfill defaults for existing tenants
UPDATE "TenantConfig"
SET "networkLearningOptIn" = FALSE
WHERE "networkLearningOptIn" IS NULL;

UPDATE "TenantConfig"
SET "networkLearning" = COALESCE("networkLearning", '{"enabled": false}'::jsonb)
WHERE "networkLearning" IS NULL;
