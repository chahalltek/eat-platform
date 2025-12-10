"use client";

import type { SystemExecutionState } from "@/lib/systemStatus";

const bannerStyles: Record<SystemExecutionState["state"], { border: string; text: string; bg: string; icon: string; title: string }> = {
  operational: {
    border: "border-emerald-200",
    text: "text-emerald-900",
    bg: "bg-emerald-50",
    icon: "✅",
    title: "System operational",
  },
  idle: {
    border: "border-amber-200",
    text: "text-amber-900",
    bg: "bg-amber-50",
    icon: "🟡",
    title: "System idle (no active runs)",
  },
  degraded: {
    border: "border-rose-200",
    text: "text-rose-900",
    bg: "bg-rose-50",
    icon: "🔴",
    title: "Degraded (agent failure detected)",
  },
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
};

export function SystemStateBanner({ executionState, onRefresh, isRefreshing }: SystemStateBannerProps) {
  const styles = bannerStyles[executionState.state];
  const latestRunTime = formatTimestamp(executionState.latestRunAt);
  const latestFailureTime = formatTimestamp(executionState.latestFailureAt);

  const caption = (() => {
    if (executionState.state === "degraded") {
      return latestFailureTime
        ? `Latest failure surfaced ${latestFailureTime}`
        : "Investigate recent agent activity to restore health.";
    }

    if (executionState.state === "idle") {
      return latestRunTime
        ? `Last run finished ${latestRunTime}. Start a workflow to resume activity.`
        : "No agent runs yet. Launch an agent to generate activity.";
    }

    return executionState.activeRuns > 0
      ? `${executionState.activeRuns} agent run${executionState.activeRuns === 1 ? " is" : "s are"} in progress.`
      : "Agents are ready to work.";
  })();

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 shadow-sm ${styles.border} ${styles.bg}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl" aria-hidden>
          {styles.icon}
        </span>
        <div>
          <p className={`text-sm font-semibold ${styles.text}`}>{styles.title}</p>
          <p className="text-xs text-slate-700">{caption}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRefreshing ? "Refreshing…" : "Refresh status"}
      </button>
    </div>
  );
}
