import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/server/db/prisma";
import { buildEteIndex, __testing } from "./buildEteIndex";

type AggregateRow = {
  timeToFillDays: number;
  openRoles: number;
  activeCandidates: number;
  confidence: number;
  capturedAt: Date;
};

vi.mock("@/server/db/prisma", async (importOriginal) => {
  const previousAllowConstruction = process.env.VITEST_PRISMA_ALLOW_CONSTRUCTION;
  process.env.VITEST_PRISMA_ALLOW_CONSTRUCTION = "true";

  const actual = await importOriginal<typeof import("@/server/db/prisma")>();
  process.env.VITEST_PRISMA_ALLOW_CONSTRUCTION = previousAllowConstruction;

  return {
    ...actual,
    Prisma: actual.Prisma ?? (await import("@prisma/client")).Prisma,
    prisma: {
      $queryRaw: vi.fn(),
      eteIndexSnapshot: {
        findFirst: vi.fn(),
        upsert: vi.fn(),
      },
    },
  };
});

describe("buildEteIndex", () => {
  const rows: AggregateRow[] = [
    {
      timeToFillDays: 30,
      openRoles: 30,
      activeCandidates: 10,
      confidence: 0.72,
      capturedAt: new Date("2026-01-05"),
    },
    {
      timeToFillDays: 45,
      openRoles: 20,
      activeCandidates: 25,
      confidence: 0.64,
      capturedAt: new Date("2026-01-10"),
    },
    {
      timeToFillDays: 38,
      openRoles: 10,
      activeCandidates: 5,
      confidence: 0.58,
      capturedAt: new Date("2026-01-18"),
    },
  ];

  const mockQueryRaw = prisma.$queryRaw as unknown as vi.Mock;
  const mockFindFirst = prisma.eteIndexSnapshot.findFirst as unknown as vi.Mock;
  const mockUpsert = prisma.eteIndexSnapshot.upsert as unknown as vi.Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRaw.mockResolvedValue(rows);
    mockFindFirst.mockResolvedValue({
      id: "prev",
      period: "2025-Q4",
      value: 53,
      components: {},
      createdAt: new Date("2025-12-31T00:00:00Z"),
    });
    mockUpsert.mockImplementation(({ create }) => ({
      id: "new",
      period: create.period,
      value: create.value,
      components: create.components,
      createdAt: new Date("2026-02-15T00:00:00Z"),
    }));
  });

  it("builds and stores the quarterly headline index", async () => {
    const timestamp = new Date("2026-02-15T00:00:00Z");
    const result = await buildEteIndex({ timestamp });

    expect(mockQueryRaw).toHaveBeenCalledOnce();
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { period: { not: "2026-Q1" } },
      orderBy: { createdAt: "desc" },
    });
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { period: "2026-Q1" },
      update: expect.objectContaining({ value: result.value }),
      create: expect.objectContaining({
        period: "2026-Q1",
        value: result.value,
        components: expect.anything(),
      }),
    });

    expect(result.period).toBe("2026-Q1");
    expect(result.value).toBeCloseTo(59.6, 1);
    expect(result.components).toEqual({
      talentScarcityIndex: 37.5,
      hiringVelocityIndex: 74.8,
      marketIntelligenceIndex: 64.7,
      confidenceStabilityIndex: 77.1,
    });
    expect(result.deltaPercent).toBeCloseTo(12.5, 1);
    expect(result.headline).toBe(
      "The ETE Index shows hiring pressure is up 12.5% QoQ.",
    );
    expect(result.createdAt.toISOString()).toBe("2026-02-15T00:00:00.000Z");
  });

  it("produces a baseline headline when no prior snapshot exists", async () => {
    mockFindFirst.mockResolvedValue(null);

    const timestamp = new Date("2026-02-15T00:00:00Z");
    const result = await buildEteIndex({ timestamp });

    expect(result.deltaPercent).toBeUndefined();
    expect(result.headline).toBe(`The ETE Index baseline is ${result.value.toFixed(1)}.`);
  });
});

describe("helpers", () => {
  it("calculates quarter labels in UTC", () => {
    expect(__testing.buildPeriod(new Date("2025-01-15T12:00:00Z"))).toBe("2025-Q1");
    expect(__testing.buildPeriod(new Date("2025-05-01T00:00:00Z"))).toBe("2025-Q2");
    expect(__testing.buildPeriod(new Date("2025-11-01T00:00:00Z"))).toBe("2025-Q4");
  });
});
