import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireTenantAdmin, TENANT_ROLES } from "@/lib/auth/tenantAdmin";
import { mockDb } from "@/test-helpers/db";

const { prisma, resetDbMocks } = mockDb();

describe("requireTenantAdmin", () => {
  const tenantId = "default-tenant";
  const adminUserId = "admin-user";
  const recruiterUserId = "recruiter-user";
  const unknownUserId = "ghost-user";

  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
  });

  it("allows access when TenantUser role is Admin", async () => {
    (prisma.tenantUser.findFirst as any).mockResolvedValue({
      tenantId,
      userId: adminUserId,
      role: TENANT_ROLES.Admin,
    });

    const result = await requireTenantAdmin(tenantId, adminUserId);

    expect(result.isAdmin).toBe(true);
    expect(result.tenantUser).toBeDefined();
    expect(result.tenantUser?.role).toBe("Admin");
  });

  it("denies access when TenantUser role is Recruiter", async () => {
    (prisma.tenantUser.findFirst as any).mockResolvedValue({
      tenantId,
      userId: recruiterUserId,
      role: TENANT_ROLES.Recruiter,
    });

    const result = await requireTenantAdmin(tenantId, recruiterUserId);

    expect(result.isAdmin).toBe(false);
    expect(result.tenantUser).toBeDefined();
  });

  it("denies access when no TenantUser record exists", async () => {
    (prisma.tenantUser.findFirst as any).mockResolvedValue(null);

    const result = await requireTenantAdmin(tenantId, unknownUserId);

    expect(result.isAdmin).toBe(false);
    expect(result.tenantUser).toBeUndefined();
  });

  it("normalizes admin role casing", async () => {
    (prisma.tenantUser.findFirst as any).mockResolvedValue({
      tenantId,
      userId: adminUserId,
      role: "ADMIN",
    });

    const result = await requireTenantAdmin(tenantId, adminUserId);

    expect(result.isAdmin).toBe(true);
  });

  it("accepts TENANT_ADMIN as admin role", async () => {
    (prisma.tenantUser.findFirst as any).mockResolvedValue({
      tenantId,
      userId: adminUserId,
      role: "TENANT_ADMIN",
    });

    const result = await requireTenantAdmin(tenantId, adminUserId);

    expect(result.isAdmin).toBe(true);
  });

  it("returns the underlying tenantUser record when admin", async () => {
    const record = {
      tenantId,
      userId: adminUserId,
      role: TENANT_ROLES.Admin,
      createdAt: new Date(),
    };

    (prisma.tenantUser.findFirst as any).mockResolvedValue(record);

    const result = await requireTenantAdmin(tenantId, adminUserId);

    expect(result.isAdmin).toBe(true);
    expect(result.tenantUser).toEqual(record);
  });
});
