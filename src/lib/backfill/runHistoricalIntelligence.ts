import { captureWeeklyMatchQualitySnapshots } from "@/lib/learning/matchQuality";
import { refreshTimeToFillRisksForTenant } from "@/lib/forecast/timeToFillRisk";
import {
  approveBenchmarkRelease,
  buildBenchmarkRelease,
  DEFAULT_INTERNAL_MIN_SAMPLE_SIZE,
  getBenchmarkRelease,
  publishBenchmarkRelease,
} from "@/lib/benchmarks/buildBenchmarkRelease";
import { prisma } from "@/server/db/prisma";
import { prismaAdmin } from "@/lib/prismaAdmin";
import { runLearningAggregation } from "@/lib/network/aggregateLearning";

export type HistoricalIntelligenceOptions = {
  /** Number of weeks of MQI history to backfill (starting from the current week). */
  weeks?: number;
  /** Optional tenant allow-list. When omitted, all tenants will be processed. */
  tenantIds?: string[];
  /** Milliseconds to wait between tenant runs to avoid overwhelming the DB. */
  rateLimitMs?: number;
  /** Version label to use when creating the internal benchmark release. */
  benchmarkVersion?: string;
  /** Minimum sample size for the internal benchmark release. */
  benchmarkSampleSize?: number;
  /** Window (in days) for benchmark aggregation. */
  benchmarkWindowDays?: number;
};

export type HistoricalIntelligenceResult = {
  tenantsProcessed: number;
  matchQualitySnapshots: number;
  forecastsRefreshed: number;
  benchmarkReleaseId?: string;
};

function startOfWeek(date: Date) {
  const weekStart = new Date(date);
  weekStart.setUTCHours(0, 0, 0, 0);
  const day = weekStart.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setUTCDate(weekStart.getUTCDate() + diff);
  return weekStart;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function backfillMatchQualityHistory(tenantId: string, weeks: number) {
  const currentWeek = startOfWeek(new Date());
  let snapshotCount = 0;

  for (let i = 0; i < weeks; i += 1) {
    const referenceDate = addDays(currentWeek, -7 * i);
    const snapshots = await captureWeeklyMatchQualitySnapshots(tenantId, { referenceDate });
    snapshotCount += snapshots.length;
  }

  return snapshotCount;
}

async function ensureInternalBenchmarkRelease(options: {
  benchmarkVersion?: string;
  benchmarkWindowDays: number;
  benchmarkSampleSize: number;
}) {
  const existingPublished = await prismaAdmin.benchmarkRelease.findFirst({
    where: { status: "published" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    include: { metrics: true },
  });

  if (existingPublished) {
    return existingPublished.id;
  }

  const hasAggregates = (await prismaAdmin.learningAggregate.count()) > 0;
  if (!hasAggregates) {
    const aggregation = await runLearningAggregation({ minimumSampleSize: options.benchmarkSampleSize });
    if (aggregation.created === 0) {
      return undefined;
    }
  }

  const version = options.benchmarkVersion ?? `internal-bootstrap-${new Date().toISOString().slice(0, 10)}`;

  const existingDraft = await prismaAdmin.benchmarkRelease.findFirst({
    where: { version },
    include: { metrics: true },
  });

  if (existingDraft) {
    const approvedExisting =
      existingDraft.status === "draft"
        ? await approveBenchmarkRelease(existingDraft.id, { client: prismaAdmin })
        : existingDraft;
    const publishedExisting =
      approvedExisting.status === "approved"
        ? await publishBenchmarkRelease(approvedExisting.id, { client: prismaAdmin, publishedAt: new Date() })
        : approvedExisting;

    const hydratedExisting = await getBenchmarkRelease(publishedExisting.id, prismaAdmin);
    return hydratedExisting?.id;
  }

  const release = await buildBenchmarkRelease({
    version,
    windowDays: options.benchmarkWindowDays,
    minimumSampleSize: options.benchmarkSampleSize,
    client: prismaAdmin,
  });

  const approved = await approveBenchmarkRelease(release.id, { client: prismaAdmin });
  const published = await publishBenchmarkRelease(approved.id, { client: prismaAdmin, publishedAt: new Date() });
  const hydrated = await getBenchmarkRelease(published.id, prismaAdmin);

  return hydrated?.id;
}

export async function runHistoricalIntelligence(options: HistoricalIntelligenceOptions = {}): Promise<HistoricalIntelligenceResult> {
  const weeks = options.weeks ?? 12;
  const rateLimitMs = options.rateLimitMs ?? 250;
  const benchmarkWindowDays = options.benchmarkWindowDays ?? 90;
  const benchmarkSampleSize = options.benchmarkSampleSize ?? DEFAULT_INTERNAL_MIN_SAMPLE_SIZE;

  const tenants = options.tenantIds
    ? await prisma.tenant.findMany({ where: { id: { in: options.tenantIds } }, select: { id: true } })
    : await prisma.tenant.findMany({ select: { id: true } });

  let totalSnapshots = 0;
  let totalForecasts = 0;

  for (const tenant of tenants) {
    totalSnapshots += await backfillMatchQualityHistory(tenant.id, weeks);
    await refreshTimeToFillRisksForTenant(tenant.id);
    totalForecasts += 1;
    await sleep(rateLimitMs);
  }

  const benchmarkReleaseId = await ensureInternalBenchmarkRelease({
    benchmarkVersion: options.benchmarkVersion,
    benchmarkWindowDays,
    benchmarkSampleSize,
  });

  return {
    tenantsProcessed: tenants.length,
    matchQualitySnapshots: totalSnapshots,
    forecastsRefreshed: totalForecasts,
    benchmarkReleaseId,
  } satisfies HistoricalIntelligenceResult;
}
