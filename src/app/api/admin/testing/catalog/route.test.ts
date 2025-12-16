import { describe, expect, it, vi } from "vitest";

import { getAdminTestingCatalog } from "@/lib/admin/testing/catalog";
import { USER_ROLES } from "@/lib/auth/roles";
import { makeRequest } from "@tests/test-utils/routeHarness";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

import { GET } from "./route";

describe("admin testing catalog route", () => {
  it("returns the admin testing catalog for admins", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: USER_ROLES.ADMIN });

    const response = await GET(makeRequest({ method: "GET", url: "http://localhost/api/admin/testing/catalog" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("max-age=300");
    expect(response.headers.get("cdn-cache-control")).toContain("max-age=300");
    expect(response.headers.get("vercel-cdn-cache-control")).toContain("max-age=300");
    expect(body).toEqual(getAdminTestingCatalog());
  });

  it("rejects unauthenticated requests", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET(makeRequest({ method: "GET", url: "http://localhost/api/admin/testing/catalog" }));

    expect(response.status).toBe(401);
  });

  it("rejects non-admin users", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", role: USER_ROLES.RECRUITER });

    const response = await GET(makeRequest({ method: "GET", url: "http://localhost/api/admin/testing/catalog" }));

    expect(response.status).toBe(403);
  });
});
