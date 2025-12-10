"use client";

import { useState } from "react";

import type { SubsystemKey, SubsystemState, SystemStatusMap } from "@/lib/systemStatus";

const statusLabels: Record<SubsystemKey, string> = {
  agents: "Agents",
  scoring: "Scoring Engine",
  database: "Database",
  tenantConfig: "Tenant Config",
};

const statusStyles: Record<SubsystemState, string> = {
  healthy: "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/30",
  warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30",
  error: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:border-rose-500/30",
  unknown: "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
};

function formatStatusText(status: SubsystemState) {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Warning";
    case "error":
      return "Error";
    default:
      return "Unknown";
  }
}

type SystemStatusProps = {
  initialStatus: SystemStatusMap;
};

export function SystemStatus({ initialStatus }: SystemStatusProps) {
  const [statusMap, setStatusMap] = useState<SystemStatusMap>(initialStatus);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleRefresh() {
    try {
      setIsRefreshing(true);
      const response = await fetch("/api/system-status", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Failed to refresh status");
      }

      const data = (await response.json()) as SystemStatusMap;
      setStatusMap(data);
    } catch (error) {
      console.error("[system-status] refresh failed", error);
      setStatusMap({
        agents: { status: "unknown" },
        scoring: { status: "unknown" },
        database: { status: "unknown" },
        tenantConfig: { status: "unknown" },
      });
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">System status</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Live health for EAT subsystems</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(Object.keys(statusLabels) as SubsystemKey[]).map((key) => {
          const entry = statusMap[key];
          const status = entry?.status ?? "unknown";

          return (
            <div
              key={key}
              className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{statusLabels[key]}</p>
                {entry?.detail && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{entry.detail}</p>
                )}
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}>
                {formatStatusText(status)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
