import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/admin/ops/test-registry/route";
import { getOpsTestRegistry } from "@/lib/ops/testCatalog";
import { createNextRouteTestServer } from "@tests/test-utils/nextRouteTestServer";
import { withListeningServer } from "@tests/test-utils/serverHelpers";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  canManageFeatureFlags: vi.fn(),
}));

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/auth/permissions", () => ({
  canManageFeatureFlags: mocks.canManageFeatureFlags,
}));

describe("GET /api/admin/ops/test-registry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the on-demand registry for admins", async () => {
    const registry = getOpsTestRegistry();

    mocks.getCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    mocks.canManageFeatureFlags.mockReturnValue(true);

    const server = createNextRouteTestServer(GET);

    await withListeningServer(server, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/ops/test-registry`);

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("max-age=300");

      const body = await response.json();
      expect(body).toEqual(registry);
    });
  });

  it("forbids non-admin users", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", role: "RECRUITER" });
    mocks.canManageFeatureFlags.mockReturnValue(false);

    const server = createNextRouteTestServer(GET);

    await withListeningServer(server, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/ops/test-registry`);

      expect(response.status).toBe(403);
    });
  });
});
