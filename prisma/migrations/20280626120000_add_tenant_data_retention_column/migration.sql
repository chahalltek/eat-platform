-- Add dataRetentionDays column to Tenant for retention policy support
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "dataRetentionDays" INTEGER;
