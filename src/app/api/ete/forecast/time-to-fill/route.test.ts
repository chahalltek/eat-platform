import { describe, expect, it, vi } from "vitest";
import { makeRequest } from "@tests/test-utils/routeHarness";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockGetRisks = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/forecast/timeToFillRisk", () => ({
  getTimeToFillRisksForTenant: mockGetRisks,
}));

import { GET } from "./route";

describe("GET /api/ete/forecast/time-to-fill", () => {
  const buildRequest = () =>
    makeRequest({ method: "GET", url: "http://localhost/api/ete/forecast/time-to-fill" });

  it("rejects unauthenticated requests", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
    expect(mockGetRisks).not.toHaveBeenCalled();
  });

  it("returns time-to-fill risk flags for the tenant", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", tenantId: "tenant-abc" });
    mockGetRisks.mockResolvedValue([{ jobId: "job-123", riskFlags: ["Flag"] }]);

    const response = await GET(buildRequest());

    expect(response.status).toBe(200);
    expect(mockGetRisks).toHaveBeenCalledWith("tenant-abc");

    const body = await response.json();
    expect(body.risks).toEqual([{ jobId: "job-123", riskFlags: ["Flag"] }]);
    expect(body.generatedAt).toBeDefined();
  });

  it("degrades gracefully when forecasting fails", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1", tenantId: "tenant-abc" });
    mockGetRisks.mockRejectedValue(new Error("forecasting offline"));

    const response = await GET(buildRequest());

    expect(response.status).toBe(503);

    const body = await response.json();
    expect(body.risks).toEqual([]);
    expect(body.error).toBe("Forecasts are unavailable right now.");
  });
});
