import { readFileSync } from 'node:fs';
import path from 'node:path';
import { newDb } from 'pg-mem';

const tenantUserTableMigration = readFileSync(
  path.resolve('prisma/migrations/20270630120000_add_tenant_user_memberships/migration.sql'),
  'utf8',
);
const tenantUserBackfillMigration = readFileSync(
  path.resolve('prisma/migrations/20270715120000_backfill_tenant_user_memberships/migration.sql'),
  'utf8',
);

describe('TenantUser backfill migration', () => {
  it('populates missing memberships and remains idempotent', () => {
    const db = newDb();
    const sql = db.public;

    sql.none(`
      CREATE TABLE "Tenant" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "User" (
        "id" TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "displayName" TEXT,
        "role" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    sql.none(tenantUserTableMigration);

    sql.none(`
      INSERT INTO "Tenant" ("id", "name", "status") VALUES ('default-tenant', 'Default Tenant', 'active');
      INSERT INTO "User" ("id", "tenantId", "email", "displayName", "role")
      VALUES ('admin-user', 'default-tenant', 'admin@test.demo', 'Admin', 'ADMIN');
    `);

    expect(sql.many(`SELECT * FROM "TenantUser"`)).toHaveLength(0);

    sql.none(tenantUserBackfillMigration);

    const memberships = sql.many(`SELECT * FROM "TenantUser"`);
    expect(memberships).toHaveLength(1);
    const membership = memberships[0] as Record<string, string>;
    expect(membership.tenantid ?? membership.tenantId).toBe('default-tenant');
    expect(membership.userid ?? membership.userId).toBe('admin-user');
    expect(membership.role).toBe('ADMIN');

    sql.none(tenantUserBackfillMigration);
    expect(sql.many(`SELECT * FROM "TenantUser"`)).toHaveLength(1);
  });
});
