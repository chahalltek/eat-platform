import type { PrismaClient } from "@prisma/client";

import { getTimeToFillRisksForTenant } from "@/lib/forecast/timeToFillRisk";
import { getMarketSignals } from "@/lib/market/marketSignals";
import { prisma } from "@/lib/prisma";
import type { CopilotRequest, EvidencePack } from "./strategicCopilot";

function calculateSinceDate(horizonDays: number) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (horizonDays - 1));
  return since;
}

export async function gatherEvidence({
  tenantId,
  scope,
  client = prisma,
}: {
  tenantId: string;
  scope?: CopilotRequest["scope"];
  client?: PrismaClient;
}): Promise<EvidencePack> {
  const horizonDays = scope?.horizonDays ?? 30;
  const since = calculateSinceDate(horizonDays);

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

  return {
    benchmarks: filteredBenchmarks,
    forecasts,
    marketSignals,
    mqiSignals,
    l2Results,
  } satisfies EvidencePack;
}
