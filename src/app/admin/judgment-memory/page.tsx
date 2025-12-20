import { ChartBarIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { notFound } from "next/navigation";

import { ETECard } from "@/components/ETECard";
import { getCurrentUser } from "@/lib/auth/user";
import { isAdminOrDataAccessRole } from "@/lib/auth/roles";
import { FEATURE_FLAGS, isFeatureEnabled } from "@/lib/featureFlags";
import { buildDriftPlan } from "@/lib/judgmentMemory/driftPlan";
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
  const driftAdjustments = buildDriftPlan(insights);
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

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <ETECard className="gap-3 border-indigo-100 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
                Silent drift
              </p>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Best-practice drift playbook</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Defaults and tradeoffs quietly move toward the highest-performing patterns from institutional memory. No recruiter
                alerts—just better starting positions.
              </p>
            </div>
            <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
              Adaptive
            </div>
          </div>
          <div className="grid gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              <span>Defaults adapt over time using recent hire and override lift signals.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500" aria-hidden />
              <span>Every drift is explainable on inspection with the evidence we used.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
              <span>No surprise behavior changes: shifts cap at 10% per window.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden />
              <span>Admins see the drift logic; recruiters only feel better starting presets.</span>
            </div>
          </div>
        </ETECard>

        <ETECard className="gap-3 border-emerald-100 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">
            Guardrails
          </p>
          <ul className="list-disc space-y-1 pl-4 text-sm text-zinc-700 dark:text-zinc-300">
            <li>Shifts only apply when sample sizes are stable; weak signals stay in watch mode.</li>
            <li>Confidence bands and tradeoffs nudge presets, never auto-approve actions.</li>
            <li>Each drift is logged with the evidence below for auditability.</li>
          </ul>
        </ETECard>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
              Drift visibility
            </p>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">What silently changed</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Grounded in the latest judgment memory run. Use this to explain why defaults feel smarter.
            </p>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
            No recruiter alerts
          </span>
        </div>

        <div className="grid gap-3">
          {driftAdjustments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-5 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              Awaiting enough signals to drift defaults. We will surface the next window once samples stabilize.
            </div>
          ) : (
            driftAdjustments.map((adjustment) => (
              <article
                key={adjustment.id}
                className="rounded-xl border border-indigo-100 bg-white px-4 py-4 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
                      {adjustment.segment} · {adjustment.category}
                    </p>
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{adjustment.change}</h3>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{adjustment.rationale}</p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      adjustment.status === "applied"
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100"
                        : "bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-100"
                    }`}
                  >
                    {adjustment.status === "applied" ? "Applied quietly" : "Watching (holds in presets only)"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {adjustment.signals.map((signal) => (
                    <span
                      key={signal}
                      className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-100 dark:ring-indigo-900/60"
                    >
                      {signal}
                    </span>
                  ))}
                </div>

                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Guardrail: {adjustment.guardrail}</p>
              </article>
            ))
          )}
        </div>
      </section>

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
