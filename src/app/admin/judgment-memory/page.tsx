import { ChartBarIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { notFound } from "next/navigation";

import { ETECard } from "@/components/ETECard";
import { getCurrentUser } from "@/lib/auth/user";
import { isAdminOrDataAccessRole } from "@/lib/auth/roles";
import { FEATURE_FLAGS, isFeatureEnabled } from "@/lib/featureFlags";
import { getLatestJudgmentInsights } from "@/lib/judgmentMemory/insights";

export const dynamic = "force-dynamic";

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
};

type ConfidenceBandValue = {
  bands?: Record<string, { hires: number; total: number; rate: number }>;
};

function formatPercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatCount(value?: number | null) {
  if (value == null) return "—";
  return value.toLocaleString();
}

function extractBandSummary(bands: ConfidenceBandValue["bands"]) {
  if (!bands) return "No confidence bands captured";

  const entries = Object.entries(bands);
  if (entries.length === 0) return "No confidence bands captured";

  const sorted = entries.sort(([, a], [, b]) => (b.rate ?? 0) - (a.rate ?? 0));
  const [topBand, stats] = sorted[0];
  return `${topBand}: ${formatPercent(stats.rate)} success over ${formatCount(stats.total)} decisions`;
}

function DimensionTable({
  label,
  description,
  rows,
}: {
  label: string;
  description: string;
  rows: {
    key: string;
    decisionMix?: DecisionMixValue;
    hireRate?: RateValue;
    overrideRate?: RateValue;
    overrideLift?: RateValue;
    confidenceBands?: ConfidenceBandValue["bands"];
  }[];
}) {
  return (
    <ETECard className="gap-3 border-zinc-200 shadow-sm dark:border-zinc-800">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">{label}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-300">
            <tr>
              <th className="px-4 py-3">Segment</th>
              <th className="px-4 py-3 text-right">Decision mix</th>
              <th className="px-4 py-3 text-right">Hire rate</th>
              <th className="px-4 py-3 text-right">Override rate</th>
              <th className="px-4 py-3 text-right">Override delta</th>
              <th className="px-4 py-3 text-right">Confidence band signals</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white text-zinc-800 dark:divide-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                  No aggregates available yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key}>
                  <td className="px-4 py-3 font-semibold">{row.key}</td>
                  <td className="px-4 py-3 text-right text-xs text-zinc-600 dark:text-zinc-300">
                    {row.decisionMix?.mix ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          Total {formatCount(row.decisionMix.total)}
                        </span>
                        <span>
                          submit {formatCount(row.decisionMix.mix.submit ?? 0)} · override{" "}
                          {formatCount(row.decisionMix.mix.override ?? 0)} · reject{" "}
                          {formatCount(row.decisionMix.mix.reject ?? 0)}
                        </span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatPercent(row.hireRate?.rate)}</td>
                  <td className="px-4 py-3 text-right">{formatPercent(row.overrideRate?.rate)}</td>
                  <td className="px-4 py-3 text-right">
                    {row.overrideLift?.rate != null ? formatPercent(row.overrideLift.rate) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-zinc-600 dark:text-zinc-300">
                    {extractBandSummary(row.confidenceBands)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ETECard>
  );
}

export default async function JudgmentMemoryPage() {
  const user = await getCurrentUser();

  if (!isAdminOrDataAccessRole(user?.role)) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 shadow-sm">
          <ShieldCheckIcon className="h-6 w-6" aria-hidden />
          <div>
            <h1 className="text-xl font-semibold">Admin access required</h1>
            <p className="mt-1 text-sm text-amber-800">
              Judgment memory is limited to admins and data access roles. No recruiter workflows are affected.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isEnabled = await isFeatureEnabled(FEATURE_FLAGS.JUDGMENT_MEMORY);
  if (!isEnabled) return notFound();

  const insights = await getLatestJudgmentInsights();
  const windowStart = insights[0]?.windowStart;
  const windowEnd = insights[0]?.windowEnd;

  const firmRows = insights
    .filter((insight) => insight.dimension === "firm")
    .map((insight) => ({
      key: insight.dimensionValue,
      decisionMix: insight.metrics.decision_mix?.value as DecisionMixValue,
      hireRate: insight.metrics.hire_rate?.value as RateValue,
      overrideRate: insight.metrics.override_rate?.value as RateValue,
      overrideLift: insight.metrics.override_success_delta?.value as RateValue,
      confidenceBands: (insight.metrics.confidence_band_success?.value as ConfidenceBandValue | undefined)?.bands,
    }));

  const clientRows = insights
    .filter((insight) => insight.dimension === "client")
    .map((insight) => ({
      key: insight.dimensionValue,
      decisionMix: insight.metrics.decision_mix?.value as DecisionMixValue,
      hireRate: insight.metrics.hire_rate?.value as RateValue,
      overrideRate: insight.metrics.override_rate?.value as RateValue,
      overrideLift: insight.metrics.override_success_delta?.value as RateValue,
      confidenceBands: (insight.metrics.confidence_band_success?.value as ConfidenceBandValue | undefined)?.bands,
    }));

  const roleRows = insights
    .filter((insight) => insight.dimension === "role_type")
    .map((insight) => ({
      key: insight.dimensionValue,
      decisionMix: insight.metrics.decision_mix?.value as DecisionMixValue,
      hireRate: insight.metrics.hire_rate?.value as RateValue,
      overrideRate: insight.metrics.override_rate?.value as RateValue,
      overrideLift: insight.metrics.override_success_delta?.value as RateValue,
      confidenceBands: (insight.metrics.confidence_band_success?.value as ConfidenceBandValue | undefined)?.bands,
    }));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-100">
          <ChartBarIcon className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
            Judgment memory
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Read-only institutional memory</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Aggregated decision receipts across firms, clients, and roles. Insights are descriptive only—no changes to live
            agents or recruiter workflows.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ETECard className="gap-3 border-emerald-100 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-200">
            <ShieldCheckIcon className="h-5 w-5" aria-hidden />
            Guardrails
          </div>
          <ul className="list-disc space-y-1 pl-4 text-sm text-zinc-700 dark:text-zinc-300">
            <li>Read-only insights; no recommendations or auto-enforcement.</li>
            <li>Admin-only surface, feature-flagged per tenant.</li>
            <li>No recruiter-visible UI or scoring changes.</li>
          </ul>
        </ETECard>
        <ETECard className="gap-3 border-indigo-100 shadow-sm">
          <div className="space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
              Window
            </p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {windowStart && windowEnd
                ? `${new Date(windowStart).toLocaleDateString()} — ${new Date(windowEnd).toLocaleDateString()}`
                : "Awaiting first aggregation run"}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Nightly batch aggregation only. Historical observations shown; no live inference.
            </p>
          </div>
        </ETECard>
      </div>

      <DimensionTable
        label="Firm-level patterns"
        description="Signals observed at the firm level: mix of submissions vs overrides, confidence calibration, and outcomes."
        rows={firmRows}
      />

      <DimensionTable
        label="Client-level patterns"
        description="Client-specific trends surfaced as descriptive insights. No per-candidate visibility."
        rows={clientRows}
      />

      <DimensionTable
        label="Role-type patterns"
        description="Role-type behaviors over the latest window: hiring signal consistency, override deltas, and band stability."
        rows={roleRows}
      />
    </div>
  );
}
