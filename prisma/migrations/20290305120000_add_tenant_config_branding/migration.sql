-- Add branding fields to TenantConfig for tenant-aware login branding
ALTER TABLE "TenantConfig"
  ADD COLUMN IF NOT EXISTS "brandName" TEXT,
  ADD COLUMN IF NOT EXISTS "brandLogoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "brandLogoAlt" TEXT;
