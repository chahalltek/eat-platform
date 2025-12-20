import type {
  DecisionReceipt,
  JudgmentAggregate,
  JudgmentAggregateDimension,
  JudgmentDecisionType,
} from "@/server/db/prisma";

import { prismaAdmin } from "@/lib/prismaAdmin";

export type JudgmentAggregateMetric =
  | "decision_mix"
  | "hire_rate"
  | "override_rate"
  | "confidence_band_success"
  | "override_success_delta"
  | "tenure_average"
  | "performance_average";

type DimensionAccumulator = {
  total: number;
  decisions: Record<JudgmentDecisionType, number>;
  overrides: number;
  hires: number;
  overrideHires: number;
  confidenceBands: Map<string, { hires: number; total: number }>;
  tenureDays: { total: number; count: number };
  performanceRatings: { total: number; count: number };
};

type OutcomeSnapshot = {
  hired?: boolean;
  tenureDays?: number;
  performanceRating?: number;
} | null;

type AggregateInput = {
  tenantId: string;
  windowStart: Date;
  windowEnd: Date;
  receipts: DecisionReceipt[];
};

const DEFAULT_WINDOW_DAYS = 90;

const METRIC_NAMES: JudgmentAggregateMetric[] = [
  "decision_mix",
  "hire_rate",
  "override_rate",
  "override_success_delta",
  "confidence_band_success",
  "tenure_average",
  "performance_average",
];

function buildAccumulator(): DimensionAccumulator {
  return {
    total: 0,
    decisions: {
      submit: 0,
      reject: 0,
      override: 0,
      confidence_adjustment: 0,
    },
    overrides: 0,
    hires: 0,
    overrideHires: 0,
    confidenceBands: new Map(),
    tenureDays: { total: 0, count: 0 },
    performanceRatings: { total: 0, count: 0 },
  };
}

function getDimensionValue(receipt: DecisionReceipt, dimension: JudgmentAggregateDimension): string {
  if (dimension === "firm") return receipt.firmId;
  if (dimension === "client") return receipt.clientId ?? "unassigned";
  return receipt.roleType ?? "unspecified";
}

function getOutcome(receipt: DecisionReceipt): OutcomeSnapshot {
  if (!receipt.outcome || typeof receipt.outcome !== "object") return null;

  const outcome = receipt.outcome as Record<string, unknown>;
  const hired = typeof outcome.hired === "boolean" ? outcome.hired : undefined;
  const tenureDays =
    typeof outcome.tenureDays === "number" && Number.isFinite(outcome.tenureDays)
      ? outcome.tenureDays
      : undefined;
  const performanceRating =
    typeof outcome.performanceRating === "number" && Number.isFinite(outcome.performanceRating)
      ? outcome.performanceRating
      : undefined;

  return { hired, tenureDays, performanceRating };
}

function getConfidenceBand(signals: unknown): string | null {
  if (!signals || typeof signals !== "object") return null;

  const signalObject = signals as Record<string, unknown>;
  const candidate = signalObject.confidenceBand ?? signalObject.confidence_band;

  return typeof candidate === "string" && candidate.trim() ? candidate : null;
}

export function buildAggregates({
  receipts,
  tenantId,
  windowEnd,
  windowStart,
}: AggregateInput): Omit<JudgmentAggregate, "id" | "createdAt" | "updatedAt">[] {
  const dimensionMaps: Record<JudgmentAggregateDimension, Map<string, DimensionAccumulator>> = {
    firm: new Map(),
    client: new Map(),
    role_type: new Map(),
  };

  receipts.forEach((receipt) => {
    (Object.keys(dimensionMaps) as JudgmentAggregateDimension[]).forEach((dimension) => {
      const value = getDimensionValue(receipt, dimension);
      const bucket = dimensionMaps[dimension].get(value) ?? buildAccumulator();

      bucket.total += 1;
      bucket.decisions[receipt.decisionType] = (bucket.decisions[receipt.decisionType] ?? 0) + 1;

      if (receipt.humanOverride) {
        bucket.overrides += 1;
      }

      const outcome = getOutcome(receipt);
      const confidenceBand = getConfidenceBand(receipt.signals);

      if (confidenceBand) {
        const record = bucket.confidenceBands.get(confidenceBand) ?? { hires: 0, total: 0 };
        record.total += 1;
        if (outcome?.hired) record.hires += 1;
        bucket.confidenceBands.set(confidenceBand, record);
      }

      if (outcome?.hired) {
        bucket.hires += 1;
        if (receipt.humanOverride) {
          bucket.overrideHires += 1;
        }
      }

      if (outcome?.tenureDays != null) {
        bucket.tenureDays.total += outcome.tenureDays;
        bucket.tenureDays.count += 1;
      }

      if (outcome?.performanceRating != null) {
        bucket.performanceRatings.total += outcome.performanceRating;
        bucket.performanceRatings.count += 1;
      }

      dimensionMaps[dimension].set(value, bucket);
    });
  });

  const aggregates: Omit<JudgmentAggregate, "id" | "createdAt" | "updatedAt">[] = [];

  (Object.entries(dimensionMaps) as Array<[JudgmentAggregateDimension, Map<string, DimensionAccumulator>]>).forEach(
    ([dimension, buckets]) => {
      buckets.forEach((bucket, dimensionValue) => {
        const mixMetric = {
          tenantId,
          dimension,
          dimensionValue,
          windowStart,
          windowEnd,
          metric: "decision_mix" as JudgmentAggregateMetric,
          value: {
            mix: bucket.decisions,
            total: bucket.total,
          },
          sampleSize: bucket.total,
        };

        const hireDenominator =
          bucket.decisions.submit + bucket.decisions.override || bucket.total || 1;
        const hireMetric = {
          tenantId,
          dimension,
          dimensionValue,
          windowStart,
          windowEnd,
          metric: "hire_rate" as JudgmentAggregateMetric,
          value: {
            hires: bucket.hires,
            decisions: hireDenominator,
            rate: bucket.hires / hireDenominator,
          },
          sampleSize: hireDenominator,
        };

        const overrideMetric = {
          tenantId,
          dimension,
          dimensionValue,
          windowStart,
          windowEnd,
          metric: "override_rate" as JudgmentAggregateMetric,
          value: {
            overrides: bucket.overrides,
            total: bucket.total,
            rate: bucket.total ? bucket.overrides / bucket.total : 0,
          },
          sampleSize: bucket.total,
        };

        const overrideSuccessMetric = {
          tenantId,
          dimension,
          dimensionValue,
          windowStart,
          windowEnd,
          metric: "override_success_delta" as JudgmentAggregateMetric,
          value: {
            hiresFromOverrides: bucket.overrideHires,
            overrideRate: bucket.total ? bucket.overrides / bucket.total : 0,
            overrideHireRate: bucket.overrides ? bucket.overrideHires / bucket.overrides : 0,
            baselineHireRate: bucket.total ? bucket.hires / bucket.total : 0,
            delta: bucket.overrides
              ? bucket.overrideHires / bucket.overrides - (bucket.total ? bucket.hires / bucket.total : 0)
              : 0,
          },
          sampleSize: bucket.overrides || bucket.total,
        };

        const confidenceBandMetric = {
          tenantId,
          dimension,
          dimensionValue,
          windowStart,
          windowEnd,
          metric: "confidence_band_success" as JudgmentAggregateMetric,
          value: {
            bands: Object.fromEntries(
              Array.from(bucket.confidenceBands.entries()).map(([band, stats]) => [
                band,
                {
                  ...stats,
                  rate: stats.total ? stats.hires / stats.total : 0,
                },
              ]),
            ),
          },
          sampleSize: Array.from(bucket.confidenceBands.values()).reduce((sum, band) => sum + band.total, 0),
        };

        const tenureMetric = {
          tenantId,
          dimension,
          dimensionValue,
          windowStart,
          windowEnd,
          metric: "tenure_average" as JudgmentAggregateMetric,
          value: {
            averageDays: bucket.tenureDays.count ? bucket.tenureDays.total / bucket.tenureDays.count : null,
            observations: bucket.tenureDays.count,
          },
          sampleSize: bucket.tenureDays.count,
        };

        const performanceMetric = {
          tenantId,
          dimension,
          dimensionValue,
          windowStart,
          windowEnd,
          metric: "performance_average" as JudgmentAggregateMetric,
          value: {
            averageRating: bucket.performanceRatings.count
              ? bucket.performanceRatings.total / bucket.performanceRatings.count
              : null,
            observations: bucket.performanceRatings.count,
          },
          sampleSize: bucket.performanceRatings.count,
        };

        aggregates.push(
          mixMetric,
          hireMetric,
          overrideMetric,
          overrideSuccessMetric,
          confidenceBandMetric,
          tenureMetric,
          performanceMetric,
        );
      });
    },
  );

  return aggregates;
}

function resolveWindow(now: Date, windowDays: number) {
  const windowEnd = new Date(now);
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - windowDays + 1);
  windowStart.setUTCHours(0, 0, 0, 0);
  windowEnd.setUTCHours(23, 59, 59, 999);

  return { windowStart, windowEnd };
}

export async function runJudgmentMemoryAggregation(
  now = new Date(),
  windowDays = DEFAULT_WINDOW_DAYS,
): Promise<{ tenantsProcessed: number; aggregatesWritten: number }> {
  const tenants = await prismaAdmin.tenant.findMany({ select: { id: true } });
  const { windowStart, windowEnd } = resolveWindow(now, windowDays);

  let aggregatesWritten = 0;

  for (const tenant of tenants) {
    const receipts = await prismaAdmin.decisionReceipt.findMany({
      where: {
        tenantId: tenant.id,
        createdAt: { gte: windowStart, lte: windowEnd },
      },
    });

    const aggregates = buildAggregates({ receipts, tenantId: tenant.id, windowStart, windowEnd });

    await prismaAdmin.$transaction(async (tx) => {
      await tx.judgmentAggregate.deleteMany({
        where: { tenantId: tenant.id, windowStart, windowEnd },
      });

      if (aggregates.length) {
        await tx.judgmentAggregate.createMany({ data: aggregates, skipDuplicates: true });
      }
    });

    aggregatesWritten += aggregates.length;
  }

  return { tenantsProcessed: tenants.length, aggregatesWritten };
}

export function getSupportedJudgmentMetrics() {
  return METRIC_NAMES;
}
