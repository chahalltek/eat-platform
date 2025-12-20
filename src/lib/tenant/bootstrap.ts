import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { prisma } from "@/server/db/prisma";

export function isBootstrapTenant(tenantId: string) {
  return tenantId.trim() === DEFAULT_TENANT_ID;
}

export async function ensureDefaultTenantExists() {
  await prisma.tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: { name: "Default Tenant", status: "active" },
    create: { id: DEFAULT_TENANT_ID, name: "Default Tenant", status: "active" },
  });
}

export async function ensureDefaultTenantAdminMembership(userId: string) {
  await ensureDefaultTenantExists();

  await prisma.tenantUser.upsert({
    where: { userId_tenantId: { tenantId: DEFAULT_TENANT_ID, userId } },
    update: { role: "TENANT_ADMIN" },
    create: {
      id: `tenant-user-${userId}-${DEFAULT_TENANT_ID}`,
      userId,
      tenantId: DEFAULT_TENANT_ID,
      role: "TENANT_ADMIN",
    },
  });
}
