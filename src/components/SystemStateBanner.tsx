"use client";

import Link from "next/link";

import type { SystemExecutionState } from "@/lib/systemStatus";

function formatTimestamp(iso: string | null) {
  if (!iso) return null;

  const date = new Date(iso);
  return date.toLocaleString();
}

type SystemStateBannerProps = {
  executionState: SystemExecutionState;
  onRefresh: () => void;
  isRefreshing: boolean;
};

export function SystemStateBanner({ executionState, onRefresh, isRefreshing }: SystemStateBannerProps) {
  const latestFailureTime = formatTimestamp(executionState.latestFailureAt);
  const showBanner = executionState.state === "degraded";

  if (!showBanner) {
    return null;
  }

  const incidentCountText =
    executionState.failureCountLast24h > 1
      ? ` (${executionState.failureCountLast24h} total incidents in last 24 hours)`
      : "";

  const caption = executionState.latestFailureAgentName && latestFailureTime
    ? `Latest failure: ${executionState.latestFailureAgentName} at ${latestFailureTime}${incidentCountText}`
    : "Agent failures detected. Review execution history.";

  const incidentLinkHref = executionState.latestFailureAgentName
    ? `/agents/logs?agent=${encodeURIComponent(executionState.latestFailureAgentName)}`
    : "/agents/logs";

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <span className="text-xl" aria-hidden>
          🚨
        </span>
        <div>
          <p className="text-sm font-semibold text-red-900">SYSTEM DEGRADED – Agent failure detected</p>
          <p className="text-xs text-red-800">{caption}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={incidentLinkHref}
          className="inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-red-700 hover:shadow-md"
        >
          View incident
        </Link>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-800 shadow-sm transition hover:-translate-y-0.5 hover:border-red-300 hover:text-red-900 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRefreshing ? "Refreshing…" : "Refresh status"}
        </button>
      </div>
    </div>
  );
}
