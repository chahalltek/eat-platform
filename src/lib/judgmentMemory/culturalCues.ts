import type { JudgmentAggregate, JudgmentAggregateDimension } from "@/server/db/prisma";

import { getLatestJudgmentInsights, type JudgmentInsight } from "./insights";

export type DecisionCultureCue = {
  message: string;
  scope: JudgmentAggregateDimension;
  sampleSize: number;
  windowLabel: string;
};

type CueContext = {
  clientId?: string | null;
  roleType?: string | null;
};

const MIN_SAMPLE_SIZE = 8;
const MAX_CUES = 2;

function normalize(value?: string | null) {
  return value?.trim().toLowerCase().replace(/\s+/g, "-") ?? null;
}

function formatPercent(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatWindowLabel(start: Date, end: Date) {
  const startLabel = new Date(start).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = new Date(end).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return `${startLabel} — ${endLabel}`;
}

function parseDecisionMix(metric: JudgmentAggregate | undefined) {
  if (!metric || !metric.value || typeof metric.value !== "object") return null;

  const data = metric.value as Record<string, unknown>;
  const mix = (data.mix as Record<string, unknown> | undefined) ?? {};
  const total = typeof data.total === "number" ? data.total : metric.sampleSize;

  if (typeof total !== "number" || Number.isNaN(total) || total < MIN_SAMPLE_SIZE) {
    return null;
  }

  const confidenceAdjustments = typeof mix.confidence_adjustment === "number" ? mix.confidence_adjustment : 0;
  const overrides = typeof mix.override === "number" ? mix.override : 0;

  return {
    total,
    confidenceAdjustments,
    overrides,
  };
}

function parseOverrideSuccess(metric: JudgmentAggregate | undefined) {
  if (!metric || !metric.value || typeof metric.value !== "object") return null;

  if (metric.sampleSize < MIN_SAMPLE_SIZE) return null;

  const data = metric.value as Record<string, unknown>;
  const delta = typeof data.delta === "number" ? data.delta : null;
  const baselineHireRate = typeof data.baselineHireRate === "number" ? data.baselineHireRate : null;
  const overrideHireRate = typeof data.overrideHireRate === "number" ? data.overrideHireRate : null;

  if (delta == null || baselineHireRate == null || overrideHireRate == null) return null;

  return {
    delta,
    baselineHireRate,
    overrideHireRate,
    sampleSize: metric.sampleSize,
  };
}

function parseConfidenceBand(metric: JudgmentAggregate | undefined) {
  if (!metric || !metric.value || typeof metric.value !== "object") return null;
  if (metric.sampleSize < MIN_SAMPLE_SIZE) return null;

  const data = metric.value as { bands?: Record<string, { rate?: number; total?: number }> };
  const bands = data.bands ?? {};

  const candidates = Object.entries(bands)
    .map(([band, stats]) => ({ band, rate: typeof stats.rate === "number" ? stats.rate : null, total: stats.total ?? 0 }))
    .filter((entry) => entry.rate != null && entry.total >= MIN_SAMPLE_SIZE);

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))[0];
}

function selectContextualInsights(insights: JudgmentInsight[], context: CueContext) {
  const normalizedClient = normalize(context.clientId);
  const normalizedRole = normalize(context.roleType);

  const matches = insights.filter((insight) => {
    const value = normalize(insight.dimensionValue);
    if (insight.dimension === "client" && normalizedClient && value === normalizedClient) return true;
    if (insight.dimension === "role_type" && normalizedRole && value === normalizedRole) return true;
    return false;
  });

  return matches;
}

export function buildDecisionCultureCues(insights: JudgmentInsight[], context: CueContext): DecisionCultureCue[] {
  const contextual = selectContextualInsights(insights, context);

  if (contextual.length === 0) {
    return [];
  }

  const cues: DecisionCultureCue[] = [];

  contextual.forEach((insight) => {
    const overrideSuccess = parseOverrideSuccess(insight.metrics.override_success_delta);
    if (overrideSuccess && Math.abs(overrideSuccess.delta) >= 0.01) {
      cues.push({
        message: `Most successful decisions for this ${insight.dimension === "client" ? "client" : "role"} accepted higher rate risk — overrides hired at ${formatPercent(overrideSuccess.overrideHireRate)} vs ${formatPercent(overrideSuccess.baselineHireRate)} baseline.`,
        scope: insight.dimension,
        sampleSize: overrideSuccess.sampleSize,
        windowLabel: formatWindowLabel(insight.windowStart, insight.windowEnd),
      });
    }

    const mix = parseDecisionMix(insight.metrics.decision_mix);
    if (mix && mix.confidenceAdjustments / mix.total >= 0.1) {
      const adjustmentShare = mix.confidenceAdjustments / mix.total;
      cues.push({
        message: `Top-performing recruiters usually spend more time calibrating intake for reqs like this (${formatPercent(adjustmentShare)} confidence adjustments captured).`,
        scope: insight.dimension,
        sampleSize: mix.total,
        windowLabel: formatWindowLabel(insight.windowStart, insight.windowEnd),
      });
    }

    const band = parseConfidenceBand(insight.metrics.confidence_band_success);
    if (band) {
      cues.push({
        message: `${band.band} confidence bands delivered the best outcomes recently; reinforce calibration before deciding.`,
        scope: insight.dimension,
        sampleSize: Math.max(insight.metrics.confidence_band_success?.sampleSize ?? MIN_SAMPLE_SIZE, band.total ?? MIN_SAMPLE_SIZE),
        windowLabel: formatWindowLabel(insight.windowStart, insight.windowEnd),
      });
    }
  });

  return cues.slice(0, MAX_CUES);
}

export async function getDecisionCultureCues(context: CueContext): Promise<DecisionCultureCue[]> {
  const insights = await getLatestJudgmentInsights();

  return buildDecisionCultureCues(insights, context);
}
