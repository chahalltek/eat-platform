import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getUserClaims: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth/identityProvider", () => ({
  getUserClaims: mocks.getUserClaims,
  getCurrentUser: mocks.getCurrentUser,
}));

describe("fulfillment route guard", () => {
  function createRequest() {
    return new NextRequest("http://localhost/api/fulfillment");
  }

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 when the user has fulfillment.view", async () => {
    mocks.getUserClaims.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-a",
      roles: ["ADMIN"],
      permissions: [],
      email: "user@example.com",
      displayName: "User",
    });
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      role: "ADMIN",
      permissions: [],
      email: "user@example.com",
      displayName: "User",
      tenantId: "tenant-a",
    });

    const response = await GET(createRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("returns 403 when the user lacks fulfillment.view", async () => {
    mocks.getUserClaims.mockResolvedValue({
      userId: "user-2",
      tenantId: "tenant-a",
      roles: ["EXEC"],
      permissions: [],
      email: "exec@example.com",
      displayName: "Exec User",
    });
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-2",
      role: "EXEC",
      permissions: [],
      email: "exec@example.com",
      displayName: "Exec User",
      tenantId: "tenant-a",
    });

    const response = await GET(createRequest());

    expect(response.status).toBe(403);
  });

  it("returns 401 when no user is present", async () => {
    mocks.getUserClaims.mockResolvedValue({
      userId: null,
      tenantId: "tenant-a",
      roles: [],
      permissions: [],
      email: null,
      displayName: null,
    });
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await GET(createRequest());

    expect(response.status).toBe(401);
  });
});
