import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRequest } from "@tests/test-utils/routeHarness";

import { FEATURE_FLAGS } from "@/lib/featureFlags/constants";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockGetCurrentTenantId = vi.hoisted(() => vi.fn());
const mockWithTenantContext = vi.hoisted(() => vi.fn());
const mockResolveTenantAccess = vi.hoisted(() => vi.fn());
const mockSetFeatureFlag = vi.hoisted(() => vi.fn());
const mockCanManageTenants = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/tenant", () => ({
  getCurrentTenantId: mockGetCurrentTenantId,
  withTenantContext: mockWithTenantContext,
}));

vi.mock("@/lib/tenant/access", () => ({
  resolveTenantAdminAccess: mockResolveTenantAccess,
}));

vi.mock("@/lib/tenant/roles", () => ({
  getTenantRoleFromHeaders: () => null,
}));

vi.mock("@/lib/featureFlags", () => ({
  FEATURE_FLAGS,
  setFeatureFlag: mockSetFeatureFlag,
}));

vi.mock("@/lib/auth/permissions", () => ({
  canManageTenants: mockCanManageTenants,
}));

import { POST } from "./route";

describe("POST /api/tenant/fire_drill", () => {
  const buildRequest = () => makeRequest({ method: "POST", url: "http://localhost/api/tenant/fire_drill" });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentTenantId.mockResolvedValue("tenant-a");
    mockWithTenantContext.mockImplementation(async (_tenantId: string, callback: () => Promise<unknown>) =>
      callback(),
    );
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: false, isGlobalAdmin: false, membership: null });
<<<<<<< ours
    mockSetFeatureFlag.mockResolvedValue({ name: FEATURE_FLAGS.FIRE_DRILL_MODE, enabled: true });
=======
    mockSetFeatureFlag.mockResolvedValue({ enabled: true, name: FEATURE_FLAGS.FIRE_DRILL_MODE });
>>>>>>> theirs
    mockCanManageTenants.mockReturnValue(false);
  });

  it("rejects unauthenticated callers", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST(buildRequest());

    expect(response.status).toBe(401);
    expect(mockSetFeatureFlag).not.toHaveBeenCalled();
  });

  it("forbids non-admin callers", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", role: "RECRUITER", tenantId: "tenant-a" });

    const response = await POST(buildRequest());

    expect(response.status).toBe(403);
    expect(mockSetFeatureFlag).not.toHaveBeenCalled();
    expect(mockResolveTenantAccess).toHaveBeenCalledWith(
      { id: "user-1", role: "RECRUITER", tenantId: "tenant-a" },
      "tenant-a",
      { roleHint: null },
    );
  });

  it("enables fire drill mode for tenant admins", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", tenantId: "tenant-a" });
    mockResolveTenantAccess.mockResolvedValue({ hasAccess: true, isGlobalAdmin: false, membership: { role: "ADMIN" } });
    mockSetFeatureFlag.mockResolvedValue({ name: FEATURE_FLAGS.FIRE_DRILL_MODE, enabled: true });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ name: FEATURE_FLAGS.FIRE_DRILL_MODE, enabled: true });
    expect(mockSetFeatureFlag).toHaveBeenCalledWith(FEATURE_FLAGS.FIRE_DRILL_MODE, true);
  });

  it("lets platform admins override tenant checks", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "sysadmin", role: "ADMIN", tenantId: "tenant-b" });
    mockCanManageTenants.mockReturnValue(true);

    const response = await POST(buildRequest());

    expect(response.status).toBe(200);
    expect(mockSetFeatureFlag).toHaveBeenCalledWith(FEATURE_FLAGS.FIRE_DRILL_MODE, true);
  });
});
