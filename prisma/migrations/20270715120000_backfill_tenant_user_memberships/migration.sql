-- Backfill TenantUser entries for existing users and tenants.
-- This migration is idempotent and will not create duplicates if rerun.
INSERT INTO "TenantUser" ("id", "createdAt", "role", "tenantId", "userId")
SELECT
  ('tenant-user-' || u."id" || '-' || u."tenantId"),
  CURRENT_TIMESTAMP,
  CASE WHEN u."role" IS NULL OR u."role" = '' THEN 'RECRUITER' ELSE u."role" END,
  u."tenantId",
  u."id"
FROM "User" u
JOIN "Tenant" t ON t."id" = u."tenantId"
WHERE u."tenantId" IS NOT NULL
ON CONFLICT ("userId", "tenantId") DO NOTHING;
