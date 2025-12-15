-- Add missing preset column to TenantConfig for guardrail presets
ALTER TABLE "TenantConfig"
  ADD COLUMN IF NOT EXISTS "preset" TEXT;
