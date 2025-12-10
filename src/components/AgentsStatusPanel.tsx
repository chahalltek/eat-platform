"use client";

import { useState } from "react";

import type { AgentStatusDescriptor, AgentsStatusPayload } from "@/lib/agents/statusBoard";

const statusStyles: Record<AgentStatusDescriptor["status"], string> = {
  healthy: "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/30",
  warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30",
  error: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:border-rose-500/30",
  unknown: "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
};

function formatTimestamp(value: string | null) {
  if (!value) return "Never";

  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

type AgentsStatusPanelProps = {
  initialData: AgentsStatusPayload;
};

export function AgentsStatusPanel({ initialData }: AgentsStatusPanelProps) {
  const [payload, setPayload] = useState<AgentsStatusPayload>(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refresh() {
    setIsRefreshing(true);

    try {
      const response = await fetch("/api/agents/status", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Failed to refresh agent status");
      }

      const next = (await response.json()) as AgentsStatusPayload;
      setPayload(next);
    } catch (error) {
      console.error("[agents-status-panel] refresh failed", error);
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
            Agents status
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Unified health &amp; activity for all agents</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {isRefreshing ? "Checking..." : "Re-run checks"}
          </button>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Updated {formatTimestamp(payload.generatedAt)}</span>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {payload.agents.map((agent) => (
          <article
            key={agent.agentName}
            className="flex flex-col gap-4 rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{agent.label}</p>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${statusStyles[agent.status]}`}
                  >
                    {agent.statusDetail}
                  </span>
                </div>
                <p className="text-xs uppercase text-zinc-500">{agent.agentName}</p>
              </div>
              <div className="text-right text-xs text-zinc-600 dark:text-zinc-400">
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">Last run</p>
                <p>{formatTimestamp(agent.lastRunAt)}</p>
                {agent.lastRunStatus !== 'UNKNOWN' && (
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Outcome: {agent.lastRunStatus}
                    {agent.lastRunDurationMs ? ` · ${(agent.lastRunDurationMs / 1000).toFixed(1)}s` : ''}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-xs uppercase text-zinc-500">Kill switch</p>
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                  {agent.killSwitchLatched ? 'Latched' : 'Disarmed'}
                </p>
                {agent.killSwitchLatched && (
                  <p className="text-xs text-rose-500 dark:text-rose-400">{agent.killSwitchReason ?? 'Disabled'}</p>
                )}
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-xs uppercase text-zinc-500">Recent failures (24h)</p>
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">{agent.failureCount24h}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Last failure: {agent.lastFailureAt ? formatTimestamp(agent.lastFailureAt) : 'None recorded'}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-xs uppercase text-zinc-500">Last success</p>
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                  {agent.lastSuccessAt ? formatTimestamp(agent.lastSuccessAt) : 'No success yet'}
                </p>
                {agent.lastErrorMessage && (
                  <p className="text-xs text-rose-500 dark:text-rose-400" title={agent.lastErrorMessage}>
                    {agent.lastErrorMessage}
                  </p>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
