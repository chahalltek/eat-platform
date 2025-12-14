-- Ensure the default tenant exists
INSERT INTO "Tenant" ("id", "name", "status")
VALUES ('default-tenant', 'Default Tenant', 'active')
ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "status" = EXCLUDED."status";

-- Attach admin users to the default tenant as tenant admins
INSERT INTO "TenantUser" ("id", "createdAt", "role", "tenantId", "userId")
SELECT
  ('tenant-user-' || u."id" || '-default-tenant'),
  CURRENT_TIMESTAMP,
  'TENANT_ADMIN',
  'default-tenant',
  u."id"
FROM "User" u
WHERE upper(u."role") = 'ADMIN'
ON CONFLICT ("userId", "tenantId") DO UPDATE SET "role" = 'TENANT_ADMIN';
