import { describe, expect, it, vi } from "vitest";

import { makeRequest } from "@tests/test-utils/routeHarness";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

import { GET as CanonicalGET, POST as CanonicalPOST } from "../../ete/tests/route";
import { GET as AliasGET, POST as AliasPOST } from "./route";

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

  it("keeps the POST catalog alias wired to the canonical handler", () => {
    expect(AliasPOST).toBe(CanonicalPOST);
  });

  it("returns an empty array for POST requests from admins", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-2", role: "ADMIN" });

    const response = await AliasPOST(
      makeRequest({ method: "POST", url: "http://localhost/api/admin/testing/catalog" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });
});
