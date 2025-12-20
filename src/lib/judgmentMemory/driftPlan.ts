import type { JudgmentInsight } from "./insights";

export type DriftAdjustment = {
  id: string;
  dimension: JudgmentInsight["dimension"];
  segment: string;
  category: "defaults" | "tradeoffs" | "confidence";
  status: "applied" | "watching";
  change: string;
  rationale: string;
  signals: string[];
  guardrail: string;
};

type DecisionMixValue = {
  mix?: Record<string, number>;
  total?: number;
};

type RateValue = {
  rate?: number;
  hires?: number;
  decisions?: number;
  overrides?: number;
  total?: number;
  delta?: number;
  overrideRate?: number;
  overrideHireRate?: number;
  baselineHireRate?: number;
};

type BandStats = { hires?: number; total?: number; rate?: number };

const DIMENSION_LABEL: Record<JudgmentInsight["dimension"], string> = {
  firm: "Firm",
  client: "Client",
  role_type: "Role type",
};

function asObject<T extends Record<string, unknown>>(value: unknown): T | null {
  if (!value || typeof value !== "object") return null;
  return value as T;
}

function formatPercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function getDecisionMix(metric?: JudgmentInsight["metrics"][string]): DecisionMixValue | null {
  if (!metric) return null;
  return asObject<DecisionMixValue>(metric.value);
}

function getRate(metric?: JudgmentInsight["metrics"][string]): RateValue | null {
  if (!metric) return null;
  return asObject<RateValue>(metric.value);
}

function getTopConfidenceBand(metric?: JudgmentInsight["metrics"][string]) {
  if (!metric) return null;

  const value = asObject<{ bands?: Record<string, BandStats> }>(metric.value);
  if (!value?.bands) return null;

  const entries = Object.entries(value.bands)
    .map(([band, stats]) => ({ band, ...stats }))
    .filter((entry) => typeof entry.total === "number" && entry.total > 0);

  if (entries.length === 0) return null;

  return entries.sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))[0];
}

export function buildDriftPlan(insights: JudgmentInsight[]): DriftAdjustment[] {
  const adjustments: DriftAdjustment[] = [];

  insights.forEach((insight) => {
    const { dimension, dimensionValue, metrics } = insight;
    const decisionMix = getDecisionMix(metrics.decision_mix);
    const hireRate = getRate(metrics.hire_rate);
    const overrideRate = getRate(metrics.override_rate);
    const overrideLift = getRate(metrics.override_success_delta);
    const topBand = getTopConfidenceBand(metrics.confidence_band_success);

    const totalDecisions = decisionMix?.total ?? 0;
    const overridesSample = metrics.override_success_delta?.sampleSize ?? 0;
    const hasDirectionalSample = totalDecisions >= 3;
    const label = `${DIMENSION_LABEL[dimension]} — ${dimensionValue}`;

    if (hireRate?.rate != null && hasDirectionalSample && hireRate.rate >= 0.5) {
      adjustments.push({
        id: `${dimension}:${dimensionValue}:defaults`,
        dimension,
        segment: label,
        category: "defaults",
        status: totalDecisions >= 20 && hireRate.rate >= 0.55 ? "applied" : "watching",
        change: "Defaults now start closer to high-performing patterns",
        rationale: `Recent ${label.toLowerCase()} decisions deliver ${formatPercent(hireRate.rate)} success across ${totalDecisions} calls, so shortlist and weighting presets quietly bias toward that mix.`,
        signals: [
          `Decision mix: submit ${decisionMix?.mix?.submit ?? 0} · override ${decisionMix?.mix?.override ?? 0} · reject ${decisionMix?.mix?.reject ?? 0}`,
          `Hire rate over decisions: ${formatPercent(hireRate.rate)}`,
        ],
        guardrail: "Capped at ±10% preset drift per window and logged for admin review.",
      });
    }

    if (overrideLift?.delta != null && overridesSample >= 1 && overrideLift.delta > 0.05) {
      adjustments.push({
        id: `${dimension}:${dimensionValue}:tradeoffs`,
        dimension,
        segment: label,
        category: "tradeoffs",
        status: overridesSample >= 8 ? "applied" : "watching",
        change: "Tradeoff suggestions favor proven override patterns",
        rationale: `Overrides outperform baseline by ${formatPercent(overrideLift.delta)}, so suggestion sliders lean into the override profile instead of generic guidance.`,
        signals: [
          `Overrides evaluated: ${overridesSample} (${formatPercent(overrideRate?.rate ?? 0)} of activity)`,
          `Override hire rate: ${formatPercent(overrideLift.overrideHireRate)} vs baseline ${formatPercent(overrideLift.baselineHireRate)}`,
        ],
        guardrail: "Only nudges the recommendation weight; never auto-approves overrides.",
      });
    }

    if (topBand?.rate != null && topBand.total != null && topBand.total >= 3 && topBand.rate >= 0.55) {
      adjustments.push({
        id: `${dimension}:${dimensionValue}:confidence`,
        dimension,
        segment: label,
        category: "confidence",
        status: topBand.total >= 10 ? "applied" : "watching",
        change: "Confidence expectations are recalibrated",
        rationale: `${topBand.band} band decisions are landing at ${formatPercent(topBand.rate)} success over ${topBand.total} samples, so confidence prompts now anchor on that band by default.`,
        signals: [
          `${topBand.band} band wins: ${topBand.hires ?? 0} / ${topBand.total}`,
          `Next best band is held steady to avoid sudden jumps`,
        ],
        guardrail: "No recruiter alerts fired; confidence bands shift only when stability thresholds are met.",
      });
    }
  });

  return adjustments.sort((a, b) => a.segment.localeCompare(b.segment));
}
