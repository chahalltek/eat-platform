import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveTenantAdminAccess } from "./access";
import { TENANT_ROLES } from "./roles";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    tenantUser: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/server/db/prisma", () => ({ prisma: prismaMock }));

describe("resolveTenantAdminAccess", () => {
  beforeEach(() => {
    prismaMock.tenantUser.findUnique.mockReset();
  });

  const adminUser = { id: "user-1", email: "admin@test.demo", displayName: "Admin", role: "ADMIN", tenantId: "default" };
  const recruiterUser = {
    id: "user-2",
    email: "recruiter@test.demo",
    displayName: "Recruiter",
    role: "RECRUITER",
    tenantId: "default",
  };

  const dataAccessUser = {
    id: "user-3",
    email: "data@test.demo",
    displayName: "Data",
    role: "DATA_ACCESS",
    tenantId: "default",
  };

  it("requires tenant membership when admin hint is supplied without global role", async () => {
    prismaMock.tenantUser.findUnique.mockResolvedValue(null);

    const access = await resolveTenantAdminAccess(recruiterUser, "default-tenant", {
      roleHint: TENANT_ROLES.Admin,
    });

    expect(access.hasAccess).toBe(false);
    expect(access.isGlobalAdmin).toBe(false);
    expect(prismaMock.tenantUser.findUnique).toHaveBeenCalled();
  });

  it("uses membership lookup when no admin hint is available", async () => {
    prismaMock.tenantUser.findUnique.mockResolvedValue({ role: TENANT_ROLES.Admin });

    const access = await resolveTenantAdminAccess(recruiterUser, "default-tenant", { roleHint: TENANT_ROLES.Recruiter });

    expect(access.hasAccess).toBe(true);
    expect(access.isGlobalAdmin).toBe(false);
  });

  it("returns false when no admin signals are present", async () => {
    prismaMock.tenantUser.findUnique.mockResolvedValue(null);

    const access = await resolveTenantAdminAccess(recruiterUser, "default-tenant", { roleHint: TENANT_ROLES.Recruiter });

    expect(access.hasAccess).toBe(false);
    expect(access.isGlobalAdmin).toBe(false);
  });

  it("keeps granting access for global admins", async () => {
    prismaMock.tenantUser.findUnique.mockResolvedValue(null);

    const access = await resolveTenantAdminAccess(adminUser, "default-tenant");

    expect(access.hasAccess).toBe(true);
    expect(access.isGlobalAdmin).toBe(true);
    expect(prismaMock.tenantUser.findUnique).not.toHaveBeenCalled();
  });

  it("treats data access roles as privileged for admin views", async () => {
    prismaMock.tenantUser.findUnique.mockResolvedValue(null);

    const access = await resolveTenantAdminAccess(dataAccessUser, "default-tenant");

    expect(access.hasAccess).toBe(true);
    expect(access.isGlobalAdmin).toBe(true);
    expect(prismaMock.tenantUser.findUnique).not.toHaveBeenCalled();
  });
});
