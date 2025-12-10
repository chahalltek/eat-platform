import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/auth/roles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/roles")>();
  return { ...actual };
});

import { POST } from "./route";

describe("POST /api/admin/eat/seed-sample-data", () => {
  const buildRequest = () =>
    new NextRequest("http://localhost/api/admin/eat/seed-sample-data", { method: "POST" });

  it("rejects unauthenticated callers", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST(buildRequest());

    expect(response.status).toBe(401);
  });

  it("blocks non-admin users", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", role: "RECRUITER" });

    const response = await POST(buildRequest());

    expect(response.status).toBe(403);
  });

  it("responds for admins", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.message).toContain("not enabled");
  });
});
