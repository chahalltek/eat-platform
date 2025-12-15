import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/admin/testing/catalog/route";
import { getAdminTestingCatalog } from "@/lib/admin/testing/catalog";
import { USER_ROLES } from "@/lib/auth/roles";
import { createNextRouteTestServer } from "@tests/test-utils/nextRouteTestServer";
import { withListeningServer } from "@tests/test-utils/serverHelpers";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

describe("GET /api/admin/testing/catalog", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the catalog for admins", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "admin-1", role: USER_ROLES.ADMIN });
    const server = createNextRouteTestServer(GET);

    await withListeningServer(server, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/testing/catalog`);

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("max-age=300");
      expect(response.headers.get("cdn-cache-control")).toContain("max-age=300");
      expect(response.headers.get("vercel-cdn-cache-control")).toContain("max-age=300");

      const body = await response.json();
      expect(body).toEqual(getAdminTestingCatalog());
    });
  });

  it("rejects unauthenticated requests", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const server = createNextRouteTestServer(GET);

    await withListeningServer(server, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/testing/catalog`);

      expect(response.status).toBe(401);
    });
  });

  it("rejects non-admin users", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", role: USER_ROLES.RECRUITER });
    const server = createNextRouteTestServer(GET);

    await withListeningServer(server, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/testing/catalog`);

      expect(response.status).toBe(403);
    });
  });
});
