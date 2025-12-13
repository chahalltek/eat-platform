import type { BenchmarkMetric, BenchmarkRelease, LearningAggregate, PrismaClient } from "@prisma/client";

import { intelligenceCache } from "@/lib/cache/intelligenceCache";
import { prisma } from "@/lib/prisma";
import { startTiming } from "@/lib/observability/timing";

export type BenchmarkMetricKey =
  | "median_time_to_fill"
  | "skill_scarcity_index"
  | "confidence_high_rate"
  | "confidence_low_rate"
  | "mqi_avg";

export type BenchmarkReleaseWithMetrics = BenchmarkRelease & { metrics: BenchmarkMetric[] };

export const DEFAULT_PUBLISHABLE_MIN_SAMPLE_SIZE = 25;
export const DEFAULT_INTERNAL_MIN_SAMPLE_SIZE = 10;

const METRIC_MAPPINGS: Record<
  string,
  { metricKey: BenchmarkMetricKey; methodologyNotes: string }
> = {
  time_to_fill: {
    metricKey: "median_time_to_fill",
    methodologyNotes: "Median time-to-fill derived from aggregated placement timelines.",
  },
  median_time_to_fill: {
    metricKey: "median_time_to_fill",
    methodologyNotes: "Median time-to-fill derived from aggregated placement timelines.",
  },
  skill_scarcity: {
    metricKey: "skill_scarcity_index",
    methodologyNotes: "Skill scarcity index calculated from supply vs. demand signals.",
  },
  skill_scarcity_index: {
    metricKey: "skill_scarcity_index",
    methodologyNotes: "Skill scarcity index calculated from supply vs. demand signals.",
  },
  confidence_high_rate: {
    metricKey: "confidence_high_rate",
    methodologyNotes: "Share of evaluations landing in the high-confidence band.",
  },
  confidence_low_rate: {
    metricKey: "confidence_low_rate",
    methodologyNotes: "Share of evaluations landing in the low-confidence band.",
  },
  mqi_avg: {
    metricKey: "mqi_avg",
    methodologyNotes: "Average Match Quality Index from aggregated MQI signals.",
  },
};

type BenchmarkPrisma = Pick<
  PrismaClient,
  "learningAggregate" | "benchmarkRelease" | "benchmarkMetric" | "$transaction"
>;

type BenchmarkTransactionClient = Omit<BenchmarkPrisma, "$transaction">;

type BuildOptions = {
  version: string;
  windowDays: number;
  minimumSampleSize?: number;
  client?: BenchmarkPrisma;
};

type TransitionOptions = {
  client?: BenchmarkPrisma;
};

type PublishOptions = TransitionOptions & { publishedAt?: Date };

function resolveMapping(signalType: string) {
  return METRIC_MAPPINGS[signalType] ?? null;
}

function normalizeOptional(value: string | null | undefined) {
  return value ?? null;
}

function filterMetricsBySampleSize(
  metrics: Omit<BenchmarkMetric, "id" | "createdAt">[],
  minimumSampleSize: number,
) {
  return metrics.filter((metric) => metric.sampleSize >= minimumSampleSize);
}

function mapAggregatesToMetrics(
  aggregates: LearningAggregate[],
  minimumSampleSize: number,
): Omit<BenchmarkMetric, "id" | "createdAt">[] {
  const mapped = aggregates.flatMap((aggregate) => {
    const mapping = resolveMapping(aggregate.signalType);
    if (!mapping) return [];

    return [
      {
        releaseId: "",
        roleFamily: aggregate.roleFamily,
        industry: normalizeOptional(aggregate.industry),
        region: normalizeOptional(aggregate.region),
        metricKey: mapping.metricKey,
        metricValue: aggregate.value,
        sampleSize: aggregate.sampleSize,
        methodologyNotes: mapping.methodologyNotes,
      },
    ];
  });

  return filterMetricsBySampleSize(mapped, minimumSampleSize);
}

async function runTransaction<T>(
  client: BenchmarkPrisma,
  callback: (tx: BenchmarkTransactionClient) => Promise<T>,
) {
  if (typeof client.$transaction === "function") {
    return client.$transaction((tx) => callback(tx as BenchmarkTransactionClient)) as Promise<T>;
  }

  return callback(client);
}

export async function buildBenchmarkRelease({
  version,
  windowDays,
  minimumSampleSize = DEFAULT_PUBLISHABLE_MIN_SAMPLE_SIZE,
  client = prisma,
}: BuildOptions): Promise<BenchmarkReleaseWithMetrics> {
  const trimmedVersion = version.trim();

  const timer = startTiming({
    workload: "benchmark_aggregation",
    inputSizes: { windowDays, minimumSampleSize },
    meta: { version: trimmedVersion },
  });

  let aggregateCount = 0;
  let metricCount = 0;

  try {
    const release = await runTransaction(client, async (tx) => {
      const aggregates = await tx.learningAggregate.findMany({ where: { windowDays } });
      aggregateCount = aggregates.length;
      const metrics = mapAggregatesToMetrics(aggregates, minimumSampleSize);

      const release = await tx.benchmarkRelease.create({
        data: {
          version: trimmedVersion,
          windowDays,
          status: "draft",
        },
      });

      if (metrics.length > 0) {
        await tx.benchmarkMetric.createMany({
          data: metrics.map((metric) => ({ ...metric, releaseId: release.id })),
        });
      }

      const persistedMetrics = await tx.benchmarkMetric.findMany({
        where: { releaseId: release.id },
        orderBy: { createdAt: "asc" },
      });
      metricCount = persistedMetrics.length;

      return { ...release, metrics: persistedMetrics } satisfies BenchmarkReleaseWithMetrics;
    });

    intelligenceCache.invalidateByPrefix(["benchmark-release"]);
    intelligenceCache.invalidateByPrefix(["copilot-evidence"]);
    intelligenceCache.invalidateByPrefix(["l2"]);

    timer.end({
      cache: { hit: false },
      inputSizes: {
        windowDays,
        minimumSampleSize,
        aggregates: aggregateCount,
        metricsPersisted: metricCount,
      },
    });

    return release;
  } finally {
    timer.end({ cache: { hit: false } });
  }
}

export async function listBenchmarkReleases(client: BenchmarkPrisma = prisma) {
  return client.benchmarkRelease.findMany({
    orderBy: { createdAt: "desc" },
    include: { metrics: true },
  });
}

export async function getBenchmarkRelease(releaseId: string, client: BenchmarkPrisma = prisma) {
  return client.benchmarkRelease.findUnique({
    where: { id: releaseId },
    include: { metrics: true },
  });
}

function assertReleaseExists(release: BenchmarkRelease | null, releaseId: string): BenchmarkRelease {
  if (!release) {
    throw new Error(`Release ${releaseId} not found`);
  }

  return release;
}

export async function approveBenchmarkRelease(
  releaseId: string,
  { client = prisma }: TransitionOptions = {},
) {
  const existing = await client.benchmarkRelease.findUnique({ where: { id: releaseId } });
  const release = assertReleaseExists(existing, releaseId);

  if (release.status !== "draft") {
    throw new Error("Only draft releases can be approved");
  }

  return client.benchmarkRelease.update({
    where: { id: releaseId },
    data: { status: "approved" },
  });
}

export async function publishBenchmarkRelease(
  releaseId: string,
  { publishedAt = new Date(), client = prisma }: PublishOptions = {},
) {
  const existing = await client.benchmarkRelease.findUnique({ where: { id: releaseId } });
  const release = assertReleaseExists(existing, releaseId);

  if (release.status !== "approved") {
    throw new Error("Only approved releases can be published");
  }

  return client.benchmarkRelease.update({
    where: { id: releaseId },
    data: { status: "published", publishedAt },
  });
}
