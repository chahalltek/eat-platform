import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import { __testing, getClientRelativeBenchmarks } from "./clientRelativeBenchmarks";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenantConfig: { findUnique: vi.fn() },
    tenantLearningSignal: { findMany: vi.fn() },
    learningAggregate: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/observability/timing", () => ({
  startTiming: () => ({ end: vi.fn() }),
}));

describe("client-relative benchmarking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns opt-out messaging when tenant is not opted in", async () => {
    (prisma.tenantConfig.findUnique as unknown as Mock).mockResolvedValue({ networkLearningOptIn: false });

    const result = await getClientRelativeBenchmarks({ tenantId: "t-1" });

    expect(result.optedIn).toBe(false);
    expect(result.comparisons).toHaveLength(0);
    expect(result.notes.some((note) => note.includes("opted"))).toBe(true);
    expect(prisma.tenantLearningSignal.findMany).not.toHaveBeenCalled();
  });

  it("builds comparisons across industry, region, and size cohorts for opted-in tenants", async () => {
    (prisma.tenantConfig.findUnique as unknown as Mock).mockResolvedValue({ networkLearningOptIn: true });

    (prisma.tenantLearningSignal.findMany as unknown as Mock).mockResolvedValue([
      {
        id: "sig-1",
        tenantId: "t-1",
        roleFamily: "Engineering",
        industry: "Software",
        region: "US",
        signalType: "time_to_fill",
        value: 35,
        sampleSize: 120,
        windowDays: 90,
        capturedAt: new Date("2024-06-10T00:00:00Z"),
      },
    ]);

    (prisma.learningAggregate.findFirst as unknown as Mock).mockResolvedValue({ createdAt: new Date("2024-06-11") });
    (prisma.learningAggregate.findMany as unknown as Mock).mockResolvedValue([
      {
        id: "agg-1",
        roleFamily: "Engineering",
        industry: "Software",
        region: "US",
        signalType: "time_to_fill",
        value: 40,
        sampleSize: 80,
        windowDays: 90,
        createdAt: new Date("2024-06-11"),
      },
      {
        id: "agg-2",
        roleFamily: "Engineering",
        industry: "Software",
        region: "US",
        signalType: "time_to_fill",
        value: 44,
        sampleSize: 220,
        windowDays: 90,
        createdAt: new Date("2024-06-11"),
      },
      {
        id: "agg-3",
        roleFamily: "Engineering",
        industry: "Finance",
        region: "EMEA",
        signalType: "time_to_fill",
        value: 50,
        sampleSize: 30,
        windowDays: 90,
        createdAt: new Date("2024-06-11"),
      },
    ]);

    const result = await getClientRelativeBenchmarks({ tenantId: "t-1", roleFamily: "Engineering" });

    expect(result.optedIn).toBe(true);
    expect(result.comparisons.length).toBeGreaterThanOrEqual(2);

    const industryComparison = result.comparisons.find((entry) => entry.basis === "industry");
    expect(industryComparison?.benchmarkValue).toBe(42);
    expect(industryComparison?.delta).toBe(-7);
    expect(industryComparison?.interpretation).toContain("anonymized medians");

    const sizeComparison = result.comparisons.find((entry) => entry.basis === "size");
    expect(sizeComparison?.benchmarkValue).toBe(40);
    expect(sizeComparison?.metric).toContain("cohort");
  });

  it("buckets sample sizes into cohorts", () => {
    expect(__testing.determineSizeCohort(20)).toBe("emerging");
    expect(__testing.determineSizeCohort(120)).toBe("growth");
    expect(__testing.determineSizeCohort(250)).toBe("enterprise");
  });
});
