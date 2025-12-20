import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/server/db/prisma";
import { intelligenceCache } from "@/lib/cache/intelligenceCache";
import { __testing, getMarketSignals } from "./marketSignals";

type AggregateRow = {
  roleFamily: string;
  region: string;
  normalizedSkill: string;
  confidence: number;
  timeToFillDays: number;
  openRoles: number;
  activeCandidates: number;
  capturedAt: Date;
};

vi.mock("@/server/db/prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

describe("getMarketSignals", () => {
  const rows: AggregateRow[] = [
    {
      roleFamily: "Data",
      region: "US",
      normalizedSkill: "python",
      confidence: 0.72,
      timeToFillDays: 32,
      openRoles: 12,
      activeCandidates: 6,
      capturedAt: new Date("2024-06-01"),
    },
    {
      roleFamily: "Data",
      region: "US",
      normalizedSkill: "sql",
      confidence: 0.48,
      timeToFillDays: 28,
      openRoles: 4,
      activeCandidates: 20,
      capturedAt: new Date("2024-06-02"),
    },
    {
      roleFamily: "Data",
      region: "EMEA",
      normalizedSkill: "python",
      confidence: 0.29,
      timeToFillDays: 41,
      openRoles: 10,
      activeCandidates: 3,
      capturedAt: new Date("2024-06-03"),
    },
    {
      roleFamily: "Design",
      region: "US",
      normalizedSkill: "figma",
      confidence: 0.83,
      timeToFillDays: 22,
      openRoles: 5,
      activeCandidates: 30,
      capturedAt: new Date("2024-06-04"),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    __testing.resetCache();
    (prisma.$queryRaw as unknown as vi.Mock).mockResolvedValue(rows);
  });

  it("builds aggregated market signals with the benchmark label", async () => {
    const timestamp = new Date("2024-07-04T00:00:00Z");
    const result = await getMarketSignals({ roleFamily: "Data", region: "US", timestamp, systemMode: "pilot" });

    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
    expect(result.label).toBe("Market benchmark (aggregated)");
    expect(result.roleFamily).toBe("Data");
    expect(result.region).toBe("US");
    expect(result.skillScarcity).toEqual([
      {
        roleFamily: "Data",
        demand: 16,
        supply: 26,
        scarcityIndex: 15,
      },
    ]);
    expect(result.confidenceByRegion).toEqual([
      { region: "US", low: 0, medium: 1, high: 1, total: 2 },
    ]);
    expect(result.timeToFillBenchmarks).toEqual([
      {
        roleFamily: "Data",
        region: "US",
        averageDays: 30,
        p90Days: 32,
        sampleSize: 2,
      },
    ]);
    expect(result.oversuppliedRoles).toEqual([
      {
        roleFamily: "Data",
        region: "US",
        supplyDemandRatio: 1.625,
        openRoles: 16,
        activeCandidates: 26,
      },
    ]);
    expect(result.systemMode).toBe("pilot");
    expect(result.capturedAt).toBe(timestamp);
  });

  it("caches the aggregate rows for a day", async () => {
    const getOrCreateSpy = vi.spyOn(intelligenceCache, "getOrCreate");

    await getMarketSignals({ region: "US" });
    await getMarketSignals({ region: "US" });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(getOrCreateSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Number),
      expect.any(Function),
      undefined,
    );
  });

  it("bypasses the market signals cache when requested", async () => {
    const getOrCreateSpy = vi.spyOn(intelligenceCache, "getOrCreate");

    await getMarketSignals({ region: "US", bypassCache: true });
    await getMarketSignals({ region: "US", bypassCache: true });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(getOrCreateSpy).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.any(Number),
      expect.any(Function),
      { bypassCache: true },
    );
  });

  it("returns empty learning payloads in fire drill mode", async () => {
    const result = await getMarketSignals({ systemMode: "fire_drill" });

    expect(result.skillScarcity).toEqual([]);
    expect(result.confidenceByRegion).toEqual([]);
    expect(result.timeToFillBenchmarks).toEqual([]);
    expect(result.oversuppliedRoles).toEqual([]);
    expect(result.systemMode).toBe("fire_drill");
    expect(result.capturedAt).toBeInstanceOf(Date);
  });
});
