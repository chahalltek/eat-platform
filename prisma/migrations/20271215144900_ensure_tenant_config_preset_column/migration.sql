-- Ensure the TenantConfig preset column exists for guardrail lookups
ALTER TABLE "TenantConfig"
  ADD COLUMN IF NOT EXISTS "preset" TEXT;
