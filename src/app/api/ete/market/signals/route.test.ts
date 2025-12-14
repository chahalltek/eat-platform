import { describe, expect, it, vi } from "vitest";
import { makeRequest } from "@tests/test-utils/routeHarness";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockGetMarketSignals = vi.hoisted(() => vi.fn());
const mockLoadTenantMode = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/market/marketSignals", () => ({
  getMarketSignals: mockGetMarketSignals,
}));

vi.mock("@/lib/modes/loadTenantMode", () => ({
  loadTenantMode: mockLoadTenantMode,
}));

import { GET } from "./route";

describe("GET /api/ete/market/signals", () => {
  const buildRequest = (search = "") =>
    makeRequest({ method: "GET", url: `http://localhost/api/ete/market/signals${search}` });

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
    expect(mockGetMarketSignals).toHaveBeenCalledWith(
      expect.objectContaining({
        roleFamily: "Data",
        region: "US",
        systemMode: "production",
        bypassCache: false,
      }),
    );

    const body = await response.json();
    expect(body).toEqual({ label: "Market benchmark (aggregated)" });
  });
});
