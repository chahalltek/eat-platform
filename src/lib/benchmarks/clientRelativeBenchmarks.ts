import type { LearningAggregate, TenantConfig, TenantLearningSignal } from "@/server/db";

import { prisma } from "@/server/db";
import { startTiming } from "@/lib/observability/timing";
import { withTenantConfigSchemaFallback } from "@/lib/tenant/tenantConfigSchemaFallback";

type BenchmarkBasis = "industry" | "region" | "size";

export type ClientBenchmarkComparison = {
  metric: string;
  clientValue: number;
  benchmarkValue: number;
  delta: number;
  interpretation: string;
  basis: BenchmarkBasis;
};

export type ClientBenchmarkingResult = {
  optedIn: boolean;
  windowDays: number;
  scope: {
    roleFamily?: string | null;
    industry?: string | null;
    region?: string | null;
    sizeCohort?: string;
  };
  comparisons: ClientBenchmarkComparison[];
  notes: string[];
};

const METRIC_LABELS: Record<string, string> = {
  time_to_fill: "Median time-to-fill (days)",
  skill_scarcity: "Skill scarcity index",
  confidence_dist: "High-confidence rate",
};

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Number(((sorted[midpoint - 1] + sorted[midpoint]) / 2).toFixed(2));
  }

  return Number(sorted[midpoint].toFixed(2));
}

function coerceScopeValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function determineSizeCohort(sampleSize: number) {
  if (sampleSize >= 200) return "enterprise";
  if (sampleSize >= 75) return "growth";
  return "emerging";
}

function pickLatestSignals(signals: TenantLearningSignal[], roleFamily?: string | null) {
  const byType = new Map<string, TenantLearningSignal>();

  for (const signal of signals) {
    if (roleFamily && signal.roleFamily !== roleFamily) continue;

    const current = byType.get(signal.signalType);
    if (!current || current.capturedAt < signal.capturedAt) {
      byType.set(signal.signalType, signal);
    }
  }

  return Array.from(byType.values());
}

function resolveBenchmarkSamples(
  aggregates: LearningAggregate[],
  scope: { industry: string | null; region: string | null; sizeCohort: string },
) {
  const industryValues = aggregates
    .filter((entry) => entry.industry === scope.industry)
    .map((entry) => entry.value);

  const regionValues = aggregates.filter((entry) => entry.region === scope.region).map((entry) => entry.value);

  const sizeValues = aggregates
    .filter((entry) => determineSizeCohort(entry.sampleSize) === scope.sizeCohort)
    .map((entry) => entry.value);

  return { industryValues, regionValues, sizeValues };
}

function buildInterpretation(params: {
  basis: BenchmarkBasis;
  benchmarkValue: number;
  clientValue: number;
  scope: ClientBenchmarkingResult["scope"];
}) {
  const basisLabel =
    params.basis === "industry"
      ? params.scope.industry ?? "industry peer group"
      : params.basis === "region"
        ? params.scope.region ?? "regional peer group"
        : `${params.scope.sizeCohort ?? "peer"} cohort`;

  const delta = Number((params.clientValue - params.benchmarkValue).toFixed(2));
  const direction = delta === 0 ? "in line with" : delta > 0 ? "above" : "below";

  return `Advisory only: client signals are ${direction} the ${basisLabel} benchmark by ${Math.abs(delta).toFixed(2)}. Peer identities stay hidden; only anonymized medians are used.`;
}

async function loadTenantLearningSignals(tenantId: string, windowDays: number) {
  return prisma.tenantLearningSignal.findMany({
    where: { tenantId, windowDays },
    orderBy: { capturedAt: "desc" },
    take: 50,
  });
}

async function loadLatestAggregates(windowDays: number, signalType: string, roleFamily: string) {
  const latest = await prisma.learningAggregate.findFirst({
    where: { windowDays, signalType, roleFamily },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) return [] as LearningAggregate[];

  return prisma.learningAggregate.findMany({
    where: { windowDays, signalType, roleFamily, createdAt: { gte: latest.createdAt } },
    orderBy: { createdAt: "desc" },
  });
}

async function loadTenantConfig(tenantId: string) {
  const { result, schemaMismatch } = await withTenantConfigSchemaFallback(
    () =>
      prisma.tenantConfig.findUnique({
        where: { tenantId },
        select: { networkLearningOptIn: true, networkLearning: true },
      }),
    { tenantId },
  );

  return schemaMismatch ? null : result;
}

export async function getClientRelativeBenchmarks({
  tenantId,
  roleFamily,
  windowDays = 90,
}: {
  tenantId: string;
  roleFamily?: string | null;
  windowDays?: number;
}): Promise<ClientBenchmarkingResult> {
  const timer = startTiming({
    workload: "client_relative_benchmarking",
    inputSizes: { windowDays },
    meta: { tenantId, roleFamily: roleFamily ?? null },
  });

  try {
    const config = (await loadTenantConfig(tenantId)) as Pick<
      TenantConfig,
      "networkLearningOptIn" | "networkLearning"
    > | null;
    const optedIn = Boolean(config?.networkLearningOptIn ?? (config?.networkLearning as { enabled?: boolean } | null)?.enabled);

    if (!optedIn) {
      return {
        optedIn: false,
        windowDays,
        scope: { roleFamily: roleFamily ?? null, industry: null, region: null, sizeCohort: undefined },
        comparisons: [],
        notes: [
          "Benchmarking is only available for tenants opted into anonymized learning.",
          "No peer identities are ever exposed—only medians from k-anonymized aggregates are shared.",
        ],
      } satisfies ClientBenchmarkingResult;
    }

    const signals = await loadTenantLearningSignals(tenantId, windowDays);
    const latestSignals = pickLatestSignals(signals, roleFamily);

    const comparisons: ClientBenchmarkComparison[] = [];

    for (const signal of latestSignals) {
      const aggregates = await loadLatestAggregates(windowDays, signal.signalType, signal.roleFamily);

      if (aggregates.length === 0) continue;

      const scope = {
        roleFamily: signal.roleFamily,
        industry: coerceScopeValue(signal.industry),
        region: coerceScopeValue(signal.region),
        sizeCohort: determineSizeCohort(signal.sampleSize),
      } satisfies ClientBenchmarkingResult["scope"];

      const { industryValues, regionValues, sizeValues } = resolveBenchmarkSamples(aggregates, {
        industry: scope.industry,
        region: scope.region,
        sizeCohort: scope.sizeCohort,
      });

      const metricLabel = METRIC_LABELS[signal.signalType] ?? signal.signalType;

      if (industryValues.length > 0) {
        const benchmarkValue = median(industryValues);
        const delta = Number((signal.value - benchmarkValue).toFixed(2));
        comparisons.push({
          metric: `${metricLabel} (${scope.industry ?? "industry"} median)`,
          clientValue: Number(signal.value.toFixed(2)),
          benchmarkValue,
          delta,
          basis: "industry",
          interpretation: buildInterpretation({
            basis: "industry",
            benchmarkValue,
            clientValue: signal.value,
            scope,
          }),
        });
      }

      if (regionValues.length > 0) {
        const benchmarkValue = median(regionValues);
        const delta = Number((signal.value - benchmarkValue).toFixed(2));
        comparisons.push({
          metric: `${metricLabel} (${scope.region ?? "regional"} median)`,
          clientValue: Number(signal.value.toFixed(2)),
          benchmarkValue,
          delta,
          basis: "region",
          interpretation: buildInterpretation({
            basis: "region",
            benchmarkValue,
            clientValue: signal.value,
            scope,
          }),
        });
      }

      if (sizeValues.length > 0) {
        const benchmarkValue = median(sizeValues);
        const delta = Number((signal.value - benchmarkValue).toFixed(2));
        comparisons.push({
          metric: `${metricLabel} (${scope.sizeCohort} cohort)`,
          clientValue: Number(signal.value.toFixed(2)),
          benchmarkValue,
          delta,
          basis: "size",
          interpretation: buildInterpretation({
            basis: "size",
            benchmarkValue,
            clientValue: signal.value,
            scope,
          }),
        });
      }
    }

    const comparisonScope = {
      roleFamily: roleFamily ?? null,
      industry: latestSignals[0]?.industry ?? null,
      region: latestSignals[0]?.region ?? null,
      sizeCohort: latestSignals[0] ? determineSizeCohort(latestSignals[0].sampleSize) : undefined,
    } satisfies ClientBenchmarkingResult["scope"];

    return {
      optedIn,
      windowDays,
      scope: comparisonScope,
      comparisons,
      notes: [
        "Comparisons use medians from anonymized aggregates; no peer identities or raw resumes are surfaced.",
        "Use for advisory gut-checks only. Benchmarks do not override recruiter judgment or local context.",
      ],
    } satisfies ClientBenchmarkingResult;
  } finally {
    timer.end({ cache: { hit: false } });
  }
}

export const __testing = {
  median,
  determineSizeCohort,
  pickLatestSignals,
};
