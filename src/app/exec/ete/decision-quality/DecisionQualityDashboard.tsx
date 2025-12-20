"use client";

import {
  ArrowTrendingUpIcon,
  ChartBarIcon,
  CheckBadgeIcon,
  CloudArrowDownIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";

import type { DecisionQualitySignals } from "@/lib/metrics/decisionQuality";

type FilterState = {
  team: string | "all";
  client: string | "all";
  requisition: string | "all";
};

type ConfidenceGroup = {
  id: string;
  label: string;
  average: number | null;
  samples: number;
  lowConfidence: number;
};

function normalizeConfidence(score: number | null | undefined) {
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  return Math.min(Math.max(score, 0), 100);
}

function isPositive(entry: DecisionQualitySignals["entries"][number]) {
  const value = `${entry.feedback ?? ""} ${entry.outcome ?? ""}`.toLowerCase();
  return ["positive", "approve", "advance", "shortlist", "accepted", "hire"].some((keyword) => value.includes(keyword));
}

function isNegative(entry: DecisionQualitySignals["entries"][number]) {
  const value = `${entry.feedback ?? ""} ${entry.outcome ?? ""}`.toLowerCase();
  return ["negative", "reject", "decline", "withdraw", "fail"].some((keyword) => value.includes(keyword));
}

function calculateCorrelation(entries: DecisionQualitySignals["entries"]) {
  const samples = entries
    .map((entry) => {
      const confidence = normalizeConfidence(entry.confidenceScore);
      const signal = isPositive(entry) ? 1 : isNegative(entry) ? -1 : null;

      if (confidence == null || signal == null) return null;
      return { confidence, signal };
    })
    .filter(Boolean) as { confidence: number; signal: number }[];

  if (samples.length < 2) {
    return null;
  }

  const confidenceMean = samples.reduce((sum, sample) => sum + sample.confidence, 0) / samples.length;
  const signalMean = samples.reduce((sum, sample) => sum + sample.signal, 0) / samples.length;

  const numerator = samples.reduce(
    (sum, sample) => sum + (sample.confidence - confidenceMean) * (sample.signal - signalMean),
    0,
  );
  const confidenceVariance = samples.reduce((sum, sample) => sum + (sample.confidence - confidenceMean) ** 2, 0);
  const signalVariance = samples.reduce((sum, sample) => sum + (sample.signal - signalMean) ** 2, 0);
  const denominator = Math.sqrt(confidenceVariance * signalVariance);

  if (denominator === 0) {
    return null;
  }

  return Number((numerator / denominator).toFixed(2));
}

function groupConfidence(
  entries: DecisionQualitySignals["entries"],
  key: "clientName" | "jobId",
  labelKey: "clientName" | "jobTitle",
): ConfidenceGroup[] {
  const groups = entries.reduce<Record<string, ConfidenceGroup>>((acc, entry) => {
    const identifier = entry[key];
    const group = acc[identifier] ?? {
      id: identifier,
      label: entry[labelKey],
      average: 0,
      samples: 0,
      lowConfidence: 0,
    };

    const confidence = normalizeConfidence(entry.confidenceScore);
    if (confidence != null) {
      group.average = (group.average ?? 0) + confidence;
      group.samples += 1;
      if (confidence < 50) {
        group.lowConfidence += 1;
      }
    }

    acc[identifier] = group;
    return acc;
  }, {});

  return Object.values(groups)
    .map((group) => ({
      ...group,
      average: group.samples > 0 && group.average != null ? Number((group.average / group.samples).toFixed(1)) : null,
    }))
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
}

function formatPercentage(value: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function DecisionQualityDashboard({ signals }: { signals: DecisionQualitySignals }) {
  const [filters, setFilters] = useState<FilterState>({ team: "all", client: "all", requisition: "all" });

  const filteredEntries = useMemo(() => {
    return signals.entries.filter((entry) => {
      if (filters.team !== "all" && entry.team !== filters.team) return false;
      if (filters.client !== "all" && entry.clientName !== filters.client) return false;
      if (filters.requisition !== "all" && entry.jobId !== filters.requisition) return false;
      return true;
    });
  }, [filters.client, filters.requisition, filters.team, signals.entries]);

  const averageConfidence = useMemo(() => {
    const values = filteredEntries.map((entry) => normalizeConfidence(entry.confidenceScore)).filter((value) => value != null) as number[];
    if (values.length === 0) return null;
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
  }, [filteredEntries]);

  const correlation = useMemo(() => calculateCorrelation(filteredEntries), [filteredEntries]);
  const positiveDecisions = useMemo(() => filteredEntries.filter((entry) => isPositive(entry)), [filteredEntries]);

  const highRiskAccepted = useMemo(() => {
    const risky = positiveDecisions.filter((entry) => (normalizeConfidence(entry.confidenceScore) ?? 100) < 40);
    return {
      count: risky.length,
      share: positiveDecisions.length > 0 ? risky.length / positiveDecisions.length : null,
    };
  }, [positiveDecisions]);

  const confidenceByClient = useMemo(
    () => groupConfidence(filteredEntries, "clientName", "clientName").slice(0, 4),
    [filteredEntries],
  );
  const confidenceByReq = useMemo(
    () => groupConfidence(filteredEntries, "jobId", "jobTitle").slice(0, 6),
    [filteredEntries],
  );

  const persistentUncertainty = useMemo(
    () => confidenceByReq.filter((entry) => entry.samples >= 3 && (entry.average ?? 100) < 55),
    [confidenceByReq],
  );

  const summaryText = useMemo(() => {
    const lines = [
      `Decision quality summary (last ${signals.windowDays} days)`,
      `Filters • Team: ${filters.team === "all" ? "All" : filters.team}; Client: ${filters.client === "all" ? "All" : filters.client}; Req: ${filters.requisition === "all" ? "All" : filters.requisition}`,
      `Signals analyzed: ${filteredEntries.length}`,
      `Avg confidence: ${averageConfidence ?? "n/a"}`,
      `Confidence vs outcome correlation: ${correlation ?? "insufficient data"}`,
      `High-risk approvals (<40 confidence): ${highRiskAccepted.count} (${formatPercentage(highRiskAccepted.share)})`,
      `Persistent uncertainty flagged: ${persistentUncertainty.length} requisitions`,
      "Data sources: Match feedback and decision streams inside ETE (no ATS dependency).",
      "Notes: Dashboard is read-only and scoped to exec/data access roles by default.",
    ];

    return lines.join("\n");
  }, [
    signals.windowDays,
    filters.team,
    filters.client,
    filters.requisition,
    filteredEntries.length,
    averageConfidence,
    correlation,
    highRiskAccepted.count,
    highRiskAccepted.share,
    persistentUncertainty.length,
  ]);

  const handleExport = () => {
    const blob = new Blob([summaryText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "decision-quality-summary.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-8 space-y-8">
      <div className="grid gap-4 rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/50 dark:via-zinc-950 dark:to-emerald-950/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-300">TS-206 • Exec & Enterprise</p>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Decision quality signals</h2>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Confidence, approvals, and uncertainty per requisition—no Bullhorn/ATS dependency. Filters stay exec-only by default.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-100">
              <ShieldCheckIcon className="h-4 w-4" aria-hidden />
              Read-only
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100">
              <SparklesIcon className="h-4 w-4" aria-hidden />
              ATS-free
            </span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <ChartBarIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-300" aria-hidden />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Avg confidence</p>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{averageConfidence ?? "n/a"}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">By req/client ({signals.windowDays}d)</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <ArrowTrendingUpIcon className="h-8 w-8 text-emerald-600 dark:text-emerald-200" aria-hidden />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Confidence vs outcome</p>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{correlation ?? "n/a"}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Correlation to approvals</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <CheckBadgeIcon className="h-8 w-8 text-amber-600 dark:text-amber-200" aria-hidden />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">High-risk accepted</p>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{highRiskAccepted.count}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Share {formatPercentage(highRiskAccepted.share)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <ShieldCheckIcon className="h-8 w-8 text-blue-600 dark:text-blue-200" aria-hidden />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Persistent uncertainty</p>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{persistentUncertainty.length}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Reqs below 55 confidence</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-300">Filters</p>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Slice by team, client, or requisition</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Filters stay exec-only. Changing them recomputes live metrics without hitting an ATS.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <CloudArrowDownIcon className="h-5 w-5" aria-hidden />
            Export summary
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
            Team
            <select
              className="rounded-lg border border-zinc-300 bg-white p-2 text-sm text-zinc-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={filters.team}
              onChange={(event) => setFilters((state) => ({ ...state, team: event.target.value as FilterState["team"] }))}
            >
              <option value="all">All teams</option>
              {signals.filters.teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
            Client
            <select
              className="rounded-lg border border-zinc-300 bg-white p-2 text-sm text-zinc-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={filters.client}
              onChange={(event) =>
                setFilters((state) => ({
                  ...state,
                  client: event.target.value as FilterState["client"],
                }))
              }
            >
              <option value="all">All clients</option>
              {signals.filters.clients.map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
            Requisition
            <select
              className="rounded-lg border border-zinc-300 bg-white p-2 text-sm text-zinc-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={filters.requisition}
              onChange={(event) =>
                setFilters((state) => ({
                  ...state,
                  requisition: event.target.value as FilterState["requisition"],
                }))
              }
            >
              <option value="all">All requisitions</option>
              {signals.filters.requisitions.map((req) => (
                <option key={req.id} value={req.id}>
                  {req.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
          <p className="font-semibold">Acceptance criteria</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Dashboard loads without ATS dependency.
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Filters by team, client, and requisition.
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Exportable summary view for exec reviews.
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Clear distinction from Bullhorn analytics.
            </li>
          </ul>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-300">Confidence by client</p>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Which clients carry higher confidence?</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Averages reflect recruiter feedback only—no ATS overlays.</p>
            </div>
            <ChartBarIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-300" aria-hidden />
          </div>
          <div className="mt-4 space-y-3">
            {confidenceByClient.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">No client-level feedback captured in this window.</p>
            ) : (
              confidenceByClient.map((client) => (
                <div key={client.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <div className="flex items-center justify-between text-sm text-zinc-800 dark:text-zinc-100">
                    <span className="font-semibold">{client.label}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{client.samples} samples</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="h-2 flex-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${client.average ?? 0}%` }}
                        aria-label={`${client.label} average confidence ${client.average ?? 0}`}
                      />
                    </div>
                    <span className="ml-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{client.average ?? "n/a"}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Low confidence calls: {client.lowConfidence}{" "}
                    <span className="text-zinc-400">({client.samples > 0 ? Math.round((client.lowConfidence / client.samples) * 100) : 0}% of samples)</span>
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-300">Confidence by requisition</p>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Reqs with persistent uncertainty</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Highlights reqs where confidence stays under 55 with multiple feedback events.
              </p>
            </div>
            <ShieldCheckIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-300" aria-hidden />
          </div>
          <div className="mt-4 space-y-3">
            {confidenceByReq.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">No requisition-level feedback available for this window.</p>
            ) : (
              confidenceByReq.map((req) => (
                <div
                  key={req.id}
                  className={`rounded-xl border p-3 text-sm shadow-sm ${
                    req.average != null && req.average < 55
                      ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40"
                      : "border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-50">{req.label}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{req.samples} signals</span>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-800 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700">
                      {req.average ?? "n/a"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {req.average != null && req.average < 55
                      ? "Confidence repeatedly low — escalate to hiring team."
                      : "Confidence holding steady; keep monitoring outcomes."}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-300">Summary view</p>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Exec-ready notes</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Copies cleanly into QBRs or board decks; always labeled as ETE-native (not Bullhorn).</p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-indigo-500"
          >
            <CloudArrowDownIcon className="h-4 w-4" aria-hidden />
            Download text summary
          </button>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">Outcome alignment</p>
            <p className="mt-2">
              Correlation between confidence and positive outcomes is {correlation ?? "still being measured"}.
              {correlation != null && correlation < 0.2
                ? " Action: coach reviewers to flag uncertainty explicitly."
                : correlation != null && correlation >= 0.2
                  ? " Good alignment; keep expanding coverage."
                  : " Add more feedback to tighten the signal."}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">Risk posture</p>
            <p className="mt-2">
              {highRiskAccepted.count > 0
                ? `${highRiskAccepted.count} approvals landed below the 40 confidence threshold (${formatPercentage(highRiskAccepted.share)} of positive decisions). Flag for manual review.`
                : "No high-risk approvals recorded in this window."}
            </p>
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-200">High-risk checks are powered by ETE decision streams only.</p>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">Where to act</p>
            <p className="mt-2">
              {persistentUncertainty.length > 0
                ? `${persistentUncertainty.length} requisitions show persistent uncertainty. Share these with the hiring team for rubric tightening.`
                : "No requisitions are currently stuck in uncertainty bands; keep collecting feedback."}
            </p>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Not recruiter-facing by default — share deliberately.</p>
          </div>
        </div>
        <textarea
          readOnly
          value={summaryText}
          className="min-h-[140px] w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800 shadow-inner focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>
    </div>
  );
}
