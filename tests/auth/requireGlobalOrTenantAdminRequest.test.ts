import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireGlobalOrTenantAdmin } from "@/lib/auth/requireGlobalOrTenantAdmin";
import { USER_ROLES } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { requireTenantAdmin as checkTenantAdmin } from "@/lib/auth/tenantAdmin";
import { makeNextRequest } from "@tests/helpers";

vi.mock("@/lib/auth/user", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/tenantAdmin", () => ({ requireTenantAdmin: vi.fn() }));

describe("requireGlobalOrTenantAdmin (request)", () => {
  const tenantId = "tenant-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("grants access to global admins for any tenant", async () => {
    const userId = "global-admin";
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: userId,
      role: USER_ROLES.ADMIN,
      email: null,
      displayName: null,
      tenantId,
    });

    const result = await requireGlobalOrTenantAdmin(makeNextRequest({ url: "http://localhost/api" }), tenantId);

    expect(result.ok).toBe(true);
    expect(result.user?.id).toBe(userId);
    expect(result.access.isGlobalAdmin).toBe(true);
    expect(checkTenantAdmin).not.toHaveBeenCalled();
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

    const result = await requireGlobalOrTenantAdmin(makeNextRequest({ url: "http://localhost/api" }), tenantId);

    expect(result.ok).toBe(true);
    expect(result.user?.id).toBe(userId);
    expect(checkTenantAdmin).toHaveBeenCalledWith(tenantId, userId);
  });

  it("denies access when the user is not a tenant admin", async () => {
    const userId = "regular-user";
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: userId,
      role: USER_ROLES.RECRUITER,
      email: null,
      displayName: null,
      tenantId,
    });

    vi.mocked(checkTenantAdmin).mockResolvedValue({ isAdmin: false });

    const result = await requireGlobalOrTenantAdmin(makeNextRequest({ url: "http://localhost/api" }), tenantId);

    expect(result.ok).toBe(false);
    expect(result.response.status).toBe(403);
    expect(checkTenantAdmin).toHaveBeenCalledWith(tenantId, userId);
  });
});
