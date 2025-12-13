import type { PrismaClient } from "@prisma/client";

import { intelligenceCache, intelligenceCacheKeys, INTELLIGENCE_CACHE_TTLS } from "@/lib/cache/intelligenceCache";
import { getTimeToFillRisksForTenant } from "@/lib/forecast/timeToFillRisk";
import { getMarketSignals } from "@/lib/market/marketSignals";
import { prisma } from "@/lib/prisma";
import type { CopilotRequest, EvidencePack } from "./strategicCopilot";
import { startTiming } from "@/lib/observability/timing";

function calculateSinceDate(horizonDays: number) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (horizonDays - 1));
  return since;
}

async function loadLatestBenchmarkRelease(client: PrismaClient, bypassCache: boolean) {
  const cacheKey = intelligenceCacheKeys.benchmarkLatest();

  return intelligenceCache.getOrCreate(
    [cacheKey],
    INTELLIGENCE_CACHE_TTLS.benchmarksMs,
    () =>
      client.benchmarkRelease.findFirst({
        where: { status: "published" },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        include: { metrics: true },
      }),
    { bypassCache },
  );
}

export async function gatherEvidence({
  tenantId,
  scope,
  client = prisma,
  bypassCache = false,
}: {
  tenantId: string;
  scope?: CopilotRequest["scope"];
  client?: PrismaClient;
  bypassCache?: boolean;
}): Promise<EvidencePack> {
  const horizonDays = scope?.horizonDays ?? 30;
  const since = calculateSinceDate(horizonDays);

<<<<<<< ours
  const timer = startTiming({
    workload: "copilot_evidence",
    inputSizes: { horizonDays },
    meta: { tenantId, roleFamily: scope?.roleFamily ?? null },
  });

  try {
    const [benchmarksResult, forecastsResult, marketSignalsResult, mqiSignalsResult, l2SignalsResult] =
      await Promise.allSettled([
        client.benchmarkRelease.findFirst({
          where: { status: "published" },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          include: { metrics: true },
        }),
        getTimeToFillRisksForTenant(tenantId),
        getMarketSignals({ roleFamily: scope?.roleFamily }),
        client.tenantLearningSignal.findMany({
          where: {
            tenantId,
            signalType: "mqi",
            capturedAt: { gte: since },
            ...(scope?.roleFamily ? { roleFamily: scope.roleFamily } : {}),
          },
          orderBy: { capturedAt: "desc" },
          take: 10,
        }),
        client.tenantLearningSignal.findMany({
          where: {
            tenantId,
            signalType: "l2_result",
            capturedAt: { gte: since },
            ...(scope?.roleFamily ? { roleFamily: scope.roleFamily } : {}),
          },
          orderBy: { capturedAt: "desc" },
          take: 10,
        }),
      ]);

    const benchmarks = benchmarksResult.status === "fulfilled" ? benchmarksResult.value : null;
    const forecasts = forecastsResult.status === "fulfilled" ? forecastsResult.value : [];
    const marketSignals = marketSignalsResult.status === "fulfilled" ? marketSignalsResult.value : null;
    const mqiSignals = mqiSignalsResult.status === "fulfilled" ? mqiSignalsResult.value : [];
    const l2Results = l2SignalsResult.status === "fulfilled" ? l2SignalsResult.value : [];

    const filteredBenchmarks = benchmarks
      ? { ...benchmarks, metrics: scope?.roleFamily ? benchmarks.metrics.filter((m) => m.roleFamily === scope.roleFamily) : benchmarks.metrics }
      : null;

    timer.end({
      cache: { hit: false },
      inputSizes: {
        horizonDays,
        forecasts: forecasts.length,
        benchmarkMetrics: filteredBenchmarks?.metrics.length ?? 0,
        mqiSignals: mqiSignals.length,
        l2Signals: l2Results.length,
      },
    });

    return {
      benchmarks: filteredBenchmarks,
      forecasts,
      marketSignals,
      mqiSignals,
      l2Results,
    } satisfies EvidencePack;
  } finally {
    timer.end({ cache: { hit: false } });
  }
=======
  const cacheKey = intelligenceCacheKeys.copilotEvidence(
    tenantId,
    JSON.stringify({ ...scope, horizonDays }),
  );

  return intelligenceCache.getOrCreate(
    [cacheKey],
    INTELLIGENCE_CACHE_TTLS.copilotEvidenceMs,
    async () => {
      const [benchmarksResult, forecastsResult, marketSignalsResult, mqiSignalsResult, l2SignalsResult] =
        await Promise.allSettled([
          loadLatestBenchmarkRelease(client, bypassCache),
          getTimeToFillRisksForTenant(tenantId, { bypassCache }),
          getMarketSignals({ roleFamily: scope?.roleFamily, bypassCache }),
          client.tenantLearningSignal.findMany({
            where: {
              tenantId,
              signalType: "mqi",
              capturedAt: { gte: since },
              ...(scope?.roleFamily ? { roleFamily: scope.roleFamily } : {}),
            },
            orderBy: { capturedAt: "desc" },
            take: 10,
          }),
          client.tenantLearningSignal.findMany({
            where: {
              tenantId,
              signalType: "l2_result",
              capturedAt: { gte: since },
              ...(scope?.roleFamily ? { roleFamily: scope.roleFamily } : {}),
            },
            orderBy: { capturedAt: "desc" },
            take: 10,
          }),
        ]);

      const benchmarks = benchmarksResult.status === "fulfilled" ? benchmarksResult.value : null;
      const forecasts = forecastsResult.status === "fulfilled" ? forecastsResult.value : [];
      const marketSignals = marketSignalsResult.status === "fulfilled" ? marketSignalsResult.value : null;
      const mqiSignals = mqiSignalsResult.status === "fulfilled" ? mqiSignalsResult.value : [];
      const l2Results = l2SignalsResult.status === "fulfilled" ? l2SignalsResult.value : [];

      const filteredBenchmarks = benchmarks
        ? {
            ...benchmarks,
            metrics: scope?.roleFamily ? benchmarks.metrics.filter((m) => m.roleFamily === scope.roleFamily) : benchmarks.metrics,
          }
        : null;

      return {
        benchmarks: filteredBenchmarks,
        forecasts,
        marketSignals,
        mqiSignals,
        l2Results,
      } satisfies EvidencePack;
    },
    { bypassCache },
  );
>>>>>>> theirs
}
