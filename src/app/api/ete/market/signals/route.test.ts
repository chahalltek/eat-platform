import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockGetMarketSignals = vi.hoisted(() => vi.fn());
const mockLoadTenantMode = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/learning/marketSignals", () => ({
  getMarketSignals: mockGetMarketSignals,
}));

vi.mock("@/lib/modes/loadTenantMode", () => ({
  loadTenantMode: mockLoadTenantMode,
}));

import { GET } from "./route";

describe("GET /api/ete/market/signals", () => {
  const buildRequest = (search = "") => new NextRequest(`http://localhost/api/ete/market/signals${search}`);

  it("rejects unauthenticated callers", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
    expect(mockGetMarketSignals).not.toHaveBeenCalled();
  });

  it("returns market signals with filters", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", tenantId: "tenant-123" });
    mockLoadTenantMode.mockResolvedValue({ mode: "production" });
    mockGetMarketSignals.mockResolvedValue({ label: "Market benchmark (aggregated)" });

    const response = await GET(buildRequest("?roleFamily=Data&region=US"));

    expect(response.status).toBe(200);
    expect(mockLoadTenantMode).toHaveBeenCalledWith("tenant-123");
    expect(mockGetMarketSignals).toHaveBeenCalledWith({
      roleFamily: "Data",
      region: "US",
      systemMode: "production",
    });

    const body = await response.json();
    expect(body).toEqual({ label: "Market benchmark (aggregated)" });
  });
});
