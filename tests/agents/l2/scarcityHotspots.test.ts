import { beforeEach, describe, expect, it, vi } from "vitest";

import { runScarcityHotspots } from "@/lib/agents/l2/scarcityHotspots";
import type { MarketSignals } from "@/lib/market/marketSignals";

vi.mock("@/lib/market/marketSignals", () => ({
  getMarketSignals: vi.fn(),
}));

const mockSignals: MarketSignals = {
  label: "Market benchmark (aggregated)",
  windowDays: 90,
  roleFamily: undefined,
  region: "US",
  systemMode: "production",
  capturedAt: new Date("2024-06-01"),
  skillScarcity: [
    { roleFamily: "Data", scarcityIndex: 80, demand: 24, supply: 10 },
    { roleFamily: "Product", scarcityIndex: 65, demand: 30, supply: 20 },
    { roleFamily: "Design", scarcityIndex: 40, demand: 12, supply: 18 },
  ],
  confidenceByRegion: [
    { region: "US", low: 4, medium: 3, high: 5, total: 12 },
  ],
  timeToFillBenchmarks: [
    { roleFamily: "Data", region: "US", averageDays: 28, p90Days: 45, sampleSize: 12 },
    { roleFamily: "Product", region: "US", averageDays: 30, p90Days: 38, sampleSize: 8 },
  ],
  oversuppliedRoles: [],
};

describe("runScarcityHotspots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ranks scarcity hotspots with rationale and references", async () => {
    const getMarketSignals = vi.mocked((await import("@/lib/market/marketSignals")).getMarketSignals);
    getMarketSignals.mockResolvedValue(mockSignals);

    const result = await runScarcityHotspots({ tenantId: "tenant-1", scope: { region: "US" } });

    expect(result.question).toBe("SCARCITY_HOTSPOTS");
    expect(result.items[0].title.startsWith("Data")).toBe(true);
    expect(result.items[0].references).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "market_signal", label: mockSignals.label })]),
    );
    expect(result.items[0].rationale[0]).toContain("Scarcity index 80");
  });

  it("keeps ordering deterministic for the same inputs", async () => {
    const getMarketSignals = vi.mocked((await import("@/lib/market/marketSignals")).getMarketSignals);
    getMarketSignals.mockResolvedValue(mockSignals);

    const first = await runScarcityHotspots({ tenantId: "tenant-1" });
    const second = await runScarcityHotspots({ tenantId: "tenant-1" });

    expect(first.items.map((item) => item.title)).toEqual(second.items.map((item) => item.title));
  });
});
