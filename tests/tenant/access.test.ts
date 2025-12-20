import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { TENANT_ROLES } from "@/lib/tenant/roles";
import { prisma } from "@/server/db/prisma";

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    tenantUser: {
      findUnique: vi.fn(),
    },
  },
}));

describe("resolveTenantAdminAccess", () => {
  const tenantId = "default-tenant";
  const otherTenantId = "another-tenant";
  const tenantUser = { id: "tenant-admin", role: "RECRUITER", email: "admin@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("grants access to platform admins regardless of tenant", async () => {
    const access = await resolveTenantAdminAccess(
      { ...tenantUser, role: "ADMIN" },
      otherTenantId,
    );

    expect(access.hasAccess).toBe(true);
    expect(access.isGlobalAdmin).toBe(true);
    expect(access.membership).toBeNull();
  });

  it("grants access when the user is an admin for the requested tenant", async () => {
    (prisma.tenantUser.findUnique as any).mockResolvedValue({
      tenantId,
      userId: tenantUser.id,
      role: TENANT_ROLES.Admin,
    });

    const access = await resolveTenantAdminAccess(tenantUser, tenantId);

    expect(access.hasAccess).toBe(true);
    expect(access.membership).toEqual({
      tenantId,
      userId: tenantUser.id,
      role: TENANT_ROLES.Admin,
    });
  });

  it("denies access when the user is an admin for a different tenant", async () => {
    (prisma.tenantUser.findUnique as any).mockImplementation(({ where }: any) => {
      return where.userId_tenantId.tenantId === otherTenantId
        ? { tenantId: otherTenantId, userId: tenantUser.id, role: TENANT_ROLES.Admin }
        : null;
    });

    const access = await resolveTenantAdminAccess(tenantUser, tenantId);

    expect(access.hasAccess).toBe(false);
  });
});
