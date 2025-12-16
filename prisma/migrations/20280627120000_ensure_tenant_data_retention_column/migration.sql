-- Ensure dataRetentionDays column exists on Tenant for deployments missing the previous migration
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "dataRetentionDays" INTEGER;
