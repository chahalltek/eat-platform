import { describe, expect, it, vi } from "vitest";

import { makeRequest } from "@tests/test-utils/routeHarness";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

import { GET as CanonicalGET } from "../../ete/tests/route";
import { GET as AliasGET } from "./route";

describe("admin testing catalog route", () => {
  it("keeps the catalog alias wired to the canonical handler", () => {
    expect(AliasGET).toBe(CanonicalGET);
  });

  it("returns the test catalog for admins", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });

    const response = await AliasGET(makeRequest({ method: "GET", url: "http://localhost/api/admin/testing/catalog" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.count).toBeGreaterThan(0);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBe(body.count);
  });
});
