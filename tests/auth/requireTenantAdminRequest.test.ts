import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireTenantAdmin as handleRequireTenantAdmin } from "@/lib/auth/requireTenantAdmin";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { USER_ROLES } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { requireTenantAdmin as checkTenantAdmin } from "@/lib/auth/tenantAdmin";
import { ensureDefaultTenantAdminMembership } from "@/lib/tenant/bootstrap";
import { makeNextRequest } from "@tests/helpers";

vi.mock("@/lib/auth/user", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/tenantAdmin", () => ({ requireTenantAdmin: vi.fn() }));
vi.mock("@/lib/tenant/bootstrap", () => ({ ensureDefaultTenantAdminMembership: vi.fn() }));

describe("requireTenantAdmin (request)", () => {
  const tenantId = "tenant-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("grants access to global admin for the bootstrap tenant", async () => {
    const userId = "global-admin";
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: userId,
      role: USER_ROLES.ADMIN,
      email: null,
      displayName: null,
      tenantId: DEFAULT_TENANT_ID,
    });

    vi.mocked(checkTenantAdmin).mockResolvedValue({
      isAdmin: true,
      tenantUser: { tenantId: DEFAULT_TENANT_ID, userId, role: "TENANT_ADMIN" },
    });

    const result = await handleRequireTenantAdmin(makeNextRequest({ url: "http://localhost/api" }), DEFAULT_TENANT_ID);

    expect(result.ok).toBe(true);
    expect(result.user?.id).toBe(userId);
    expect(ensureDefaultTenantAdminMembership).toHaveBeenCalledWith(userId);
    expect(checkTenantAdmin).toHaveBeenCalledWith(DEFAULT_TENANT_ID, userId);
  });

  it("denies access to global admin for non-bootstrap tenants", async () => {
    const userId = "global-admin";
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: userId,
      role: USER_ROLES.ADMIN,
      email: null,
      displayName: null,
      tenantId,
    });

    vi.mocked(checkTenantAdmin).mockResolvedValue({ isAdmin: false });

    const result = await handleRequireTenantAdmin(makeNextRequest({ url: "http://localhost/api" }), tenantId);

    expect(result.ok).toBe(false);
    expect(result.response.status).toBe(403);
    expect(ensureDefaultTenantAdminMembership).not.toHaveBeenCalled();
    expect(checkTenantAdmin).toHaveBeenCalledWith(tenantId, userId);
  });

  it("grants access to tenant admins", async () => {
    const userId = "tenant-admin";
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: userId,
      role: USER_ROLES.TENANT_ADMIN,
      email: null,
      displayName: null,
      tenantId,
    });

    vi.mocked(checkTenantAdmin).mockResolvedValue({
      isAdmin: true,
      tenantUser: { tenantId, userId, role: USER_ROLES.TENANT_ADMIN },
    });

    const result = await handleRequireTenantAdmin(makeNextRequest({ url: "http://localhost/api" }), tenantId);

    expect(result.ok).toBe(true);
    expect(result.user?.id).toBe(userId);
    expect(ensureDefaultTenantAdminMembership).not.toHaveBeenCalled();
    expect(checkTenantAdmin).toHaveBeenCalledWith(tenantId, userId);
  });
});
