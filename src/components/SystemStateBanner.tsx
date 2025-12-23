"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import type { SystemExecutionState } from "@/lib/systemStatusTypes";

const bannerStyles: Record<SystemExecutionState["state"], { border: string; bg: string }> = {
  degraded: { border: "border-red-200", bg: "bg-red-50" },
  idle: { border: "border-amber-200", bg: "bg-amber-50" },
  operational: { border: "border-emerald-200", bg: "bg-emerald-50" },
};

function formatTimestamp(iso: string | null) {
  if (!iso) return null;

  const date = new Date(iso);
  return date.toLocaleString();
}

type SystemStateBannerProps = {
  executionState: SystemExecutionState;
  onRefresh: () => void;
  isRefreshing: boolean;
  canResetDegraded: boolean;
  onReset?: () => void;
  isResetting?: boolean;
};

export function SystemStateBanner({
  executionState,
  onRefresh,
  isRefreshing,
  canResetDegraded,
  onReset,
  isResetting = false,
}: SystemStateBannerProps) {
  const [isEntering, setIsEntering] = useState(false);
  const previousState = useRef<SystemExecutionState["state"] | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const styles = bannerStyles[executionState.state];
  const latestFailureTime = formatTimestamp(executionState.latestFailureAt);
  const showBanner = executionState.state === "degraded";

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsEntering(false);
      previousState.current = executionState.state;
      return;
    }

    if (executionState.state === "degraded" && previousState.current !== executionState.state) {
      setIsEntering(true);
      previousState.current = executionState.state;

      const timeout = setTimeout(() => setIsEntering(false), 240);

      return () => clearTimeout(timeout);
    }

    previousState.current = executionState.state;
  }, [executionState.state, prefersReducedMotion]);

  if (!showBanner) {
    return null;
  }

  const incidentCountText =
    executionState.failureCountLast24h > 1
      ? ` (${executionState.failureCountLast24h} total incidents in last 24 hours)`
      : "";

  const caption = executionState.latestFailureAgentName && latestFailureTime
    ? `Latest failure: ${executionState.latestFailureAgentName} at ${latestFailureTime}${incidentCountText}`
    : latestFailureTime
      ? `Latest failure surfaced ${latestFailureTime}${incidentCountText}`
      : "Agent failures detected. Review execution history.";

  const incidentLinkHref = executionState.latestFailureAgentName
    ? `/agents/logs?agent=${encodeURIComponent(executionState.latestFailureAgentName)}`
    : "/agents/logs";

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 shadow-sm ${styles.border} ${styles.bg} ${
        isEntering ? "banner-slide-in" : ""
      }`}
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
        {canResetDegraded ? (
          <button
            type="button"
            onClick={onReset}
            disabled={!onReset || isResetting || isRefreshing}
            className="inline-flex items-center rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-800 shadow-sm transition hover:-translate-y-0.5 hover:border-red-300 hover:text-red-900 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isResetting ? "Resetting…" : "Reset incident"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing || isResetting}
          className="inline-flex items-center rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-800 shadow-sm transition hover:-translate-y-0.5 hover:border-red-300 hover:text-red-900 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRefreshing ? "Refreshing…" : "Refresh status"}
        </button>
      </div>
    </div>
  );
}
