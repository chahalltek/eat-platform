"use client";

import { ClockIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { DecisionArtifactRecord } from "@/server/decision/decisionArtifacts";

function formatRelativeTime(timestamp: string) {
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return "Unknown time";
  }
}

function Chip({ label }: { label: string }) {
  return <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-100 dark:ring-indigo-800/60">{label}</span>;
}

type FilterValue = DecisionArtifactRecord["status"] | "all";

function normalizeSummary(payload: unknown) {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object" && "summary" in payload) {
    const summary = (payload as Record<string, unknown>).summary;
    if (typeof summary === "string" && summary.trim()) return summary;
  }
  return "Decision artifact";
}

export function DecisionTimeline({ decisions }: { decisions: DecisionArtifactRecord[] }) {
  const [status, setStatus] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return decisions.filter((decision) => {
      if (status !== "all" && decision.status !== status) {
        return false;
      }

      if (!query) return true;

      const summary = normalizeSummary(decision.payload);
      const candidateIds = decision.candidateIds.join(", ");

      return (
        summary.toLowerCase().includes(query) ||
        (decision.jobId ?? "").toLowerCase().includes(query) ||
        candidateIds.toLowerCase().includes(query) ||
        decision.type.toLowerCase().includes(query)
      );
    });
  }, [decisions, search, status]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { value: "all" as FilterValue, label: "All decisions" },
            { value: "PUBLISHED" as FilterValue, label: "Published" },
            { value: "DRAFT" as FilterValue, label: "Drafts" },
          ].map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatus(filter.value)}
              className={clsx(
                "rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset transition",
                status === filter.value
                  ? "bg-indigo-600 text-white ring-indigo-600 dark:bg-indigo-500 dark:ring-indigo-500"
                  : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700 dark:hover:bg-zinc-800",
              )}
              aria-pressed={status === filter.value}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <label className="relative block w-full min-w-[240px] max-w-xs text-sm text-zinc-600 dark:text-zinc-300">
          <span className="pointer-events-none absolute left-3 top-2.5 text-zinc-400 dark:text-zinc-500">
            <MagnifyingGlassIcon className="h-5 w-5" aria-hidden />
          </span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by candidate, job, or signal"
            className="w-full rounded-full border border-zinc-200 bg-white px-10 py-2 font-medium text-zinc-800 shadow-sm outline-none ring-0 transition placeholder:text-zinc-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/40"
          />
        </label>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            No decisions match your filters yet.
          </div>
        ) : (
          filtered.map((decision) => {
            const summary = normalizeSummary(decision.payload);
            const statusTone =
              decision.status === "DRAFT"
                ? "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-700/60"
                : "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-700/60";

            return (
              <Link
                key={decision.id}
                href={`/fulfillment/decisions/${decision.id}`}
                className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
                          statusTone,
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                        {decision.status === "DRAFT" ? "Draft" : "Published"}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
                        {decision.type}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{summary}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {decision.jobId ?? "Unassigned job"} · {decision.candidateIds.join(", ") || "No candidates"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right text-sm text-zinc-600 dark:text-zinc-300">
                    <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 font-semibold text-zinc-800 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700">
                      <ClockIcon className="h-4 w-4" aria-hidden />
                      {formatRelativeTime(decision.createdAt)}
                    </span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-100">{decision.createdByUserId}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">{decision.candidateIds.map((candidateId: string) => <Chip key={candidateId} label={`Candidate ${candidateId}`} />)}</div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
