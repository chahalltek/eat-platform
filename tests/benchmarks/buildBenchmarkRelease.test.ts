import { describe, expect, it } from "vitest";

import { approveBenchmarkRelease, buildBenchmarkRelease, publishBenchmarkRelease } from "@/lib/benchmarks/buildBenchmarkRelease";
import type { BenchmarkMetric, BenchmarkRelease, LearningAggregate } from "@prisma/client";

type MockBenchmarkClient = {
  learningAggregate: { findMany: ({ where }: { where: { windowDays: number } }) => Promise<LearningAggregate[]> };
  benchmarkRelease: {
    create: ({ data }: { data: Partial<BenchmarkRelease> }) => Promise<BenchmarkRelease>;
    update: ({ where, data }: { where: { id: string }; data: Partial<BenchmarkRelease> }) => Promise<BenchmarkRelease>;
    findUnique: ({ where }: { where: { id: string } }) => Promise<BenchmarkRelease | null>;
    findMany: () => Promise<BenchmarkRelease[]>;
  };
  benchmarkMetric: {
    createMany: ({ data }: { data: Omit<BenchmarkMetric, "id" | "createdAt">[] }) => Promise<{ count: number }>;
    findMany: ({ where }: { where: { releaseId: string } }) => Promise<BenchmarkMetric[]>;
  };
  $transaction: <T>(cb: (tx: MockBenchmarkClient) => Promise<T>) => Promise<T>;
};

type MockContext = {
  client: MockBenchmarkClient;
  releases: BenchmarkRelease[];
  metrics: BenchmarkMetric[];
};

function createMockBenchmarkClient(aggregates: LearningAggregate[]): MockContext {
  const releases: BenchmarkRelease[] = [];
  const metrics: BenchmarkMetric[] = [];
  const createdAt = new Date("2026-01-01T00:00:00Z");

  let releaseCounter = 0;
  let metricCounter = 0;

  const client: MockBenchmarkClient = {
    learningAggregate: {
      findMany: async ({ where }) => aggregates.filter((aggregate) => aggregate.windowDays === where.windowDays),
    },
    benchmarkRelease: {
      create: async ({ data }) => {
        const release: BenchmarkRelease = {
          id: `rel-${++releaseCounter}`,
          version: data.version ?? "",
          status: (data.status as string) ?? "draft",
          windowDays: data.windowDays ?? 0,
          createdAt,
          publishedAt: (data as BenchmarkRelease).publishedAt ?? null,
        };
        releases.push(release);
        return release;
      },
      update: async ({ where, data }) => {
        const index = releases.findIndex((item) => item.id === where.id);
        if (index === -1) {
          throw new Error("Release not found");
        }
        releases[index] = { ...releases[index], ...data } as BenchmarkRelease;
        return releases[index];
      },
      findUnique: async ({ where }) => releases.find((release) => release.id === where.id) ?? null,
      findMany: async () => releases,
    },
    benchmarkMetric: {
      createMany: async ({ data }) => {
        const created = data.map((metric) => ({
          ...metric,
          id: `metric-${++metricCounter}`,
          createdAt,
        })) as BenchmarkMetric[];
        metrics.push(...created);
        return { count: created.length };
      },
      findMany: async ({ where }) => metrics.filter((metric) => metric.releaseId === where.releaseId),
    },
    $transaction: async (cb) => cb(client),
  };

  return { client, releases, metrics };
}

describe("buildBenchmarkRelease", () => {
  const baseAggregate = {
    id: "aggregate-1",
    roleFamily: "Engineering",
    industry: null,
    region: null,
    signalType: "median_time_to_fill",
    value: 32,
    sampleSize: 40,
    windowDays: 90,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  } satisfies LearningAggregate;

  it("omits metrics below the minimum sample size", async () => {
    const aggregates: LearningAggregate[] = [
      { ...baseAggregate, id: "agg-small", sampleSize: 5 },
      baseAggregate,
    ];

    const { client } = createMockBenchmarkClient(aggregates);
    const release = await buildBenchmarkRelease({ version: "2026-Q1", windowDays: 90, client });

    expect(release.metrics).toHaveLength(1);
    expect(release.metrics[0]).toMatchObject({
      metricKey: "median_time_to_fill",
      sampleSize: 40,
      metricValue: 32,
    });
  });

  it("computes metrics per role family", async () => {
    const aggregates: LearningAggregate[] = [
      baseAggregate,
      {
        ...baseAggregate,
        id: "agg-scarcity",
        roleFamily: "Sales",
        signalType: "skill_scarcity",
        value: 68,
        sampleSize: 28,
      },
    ];

    const { client } = createMockBenchmarkClient(aggregates);
    const release = await buildBenchmarkRelease({
      version: "2026-Q1",
      windowDays: 90,
      minimumSampleSize: 10,
      client,
    });

    expect(release.metrics).toHaveLength(2);
    const engineering = release.metrics.find((metric) => metric.roleFamily === "Engineering");
    const sales = release.metrics.find((metric) => metric.roleFamily === "Sales");

    expect(engineering).toMatchObject({ metricKey: "median_time_to_fill", metricValue: 32 });
    expect(sales).toMatchObject({ metricKey: "skill_scarcity_index", metricValue: 68 });
  });
});

describe("benchmark release lifecycle", () => {
  const aggregates: LearningAggregate[] = [
    {
      id: "agg-lifecycle",
      roleFamily: "Engineering",
      industry: null,
      region: "EMEA",
      signalType: "confidence_high_rate",
      value: 0.54,
      sampleSize: 30,
      windowDays: 90,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
  ];

  it("requires draft to approved to published transitions", async () => {
    const { client } = createMockBenchmarkClient(aggregates);
    const release = await buildBenchmarkRelease({ version: "2026-Q1", windowDays: 90, client });

    await expect(publishBenchmarkRelease(release.id, { client })).rejects.toThrow("approved");

    const approved = await approveBenchmarkRelease(release.id, { client });
    expect(approved.status).toBe("approved");

    const publishedAt = new Date("2026-03-31T00:00:00Z");
    const published = await publishBenchmarkRelease(release.id, { client, publishedAt });

    expect(published.status).toBe("published");
    expect(published.publishedAt).toEqual(publishedAt);
  });
});
