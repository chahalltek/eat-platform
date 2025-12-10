"use client";

import { useState } from "react";

<<<<<<< ours
import { StatusPill } from "@/components/StatusPill";
import type { SubsystemKey, SystemStatusMap } from "@/lib/systemStatus";
=======
import type { SubsystemKey, SubsystemState, SystemStatusMap } from "@/lib/systemStatus";
import { StatusPill, type Status } from "@/components/StatusPill";
>>>>>>> theirs

const statusLabels: Record<SubsystemKey, string> = {
  agents: "Agents",
  scoring: "Scoring Engine",
  database: "Database",
  tenantConfig: "Tenant Config",
};

<<<<<<< ours
const statusDescriptions: Record<SubsystemKey, string> = {
  agents: "Orchestration for agent workflows.",
  scoring: "Automated scoring pipeline.",
  database: "Primary datastore availability.",
  tenantConfig: "Feature flags and tenant settings.",
};
=======
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

function toStatusPill(status: SubsystemState): Status {
  switch (status) {
    case "healthy":
      return "healthy";
    case "warning":
      return "degraded";
    case "error":
      return "down";
    case "unknown":
    default:
      return "unknown";
  }
}
>>>>>>> theirs

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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-violet-600">SYSTEM STATUS</p>
          <p className="text-sm text-slate-500">Live health for EAT subsystems.</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(statusLabels) as SubsystemKey[]).map((key) => {
          const entry = statusMap[key];
          const status = entry?.status ?? "unknown";
          const description = entry?.detail ?? statusDescriptions[key];

          return (
            <div
              key={key}
              className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{statusLabels[key]}</p>
                <p className="text-xs text-slate-500">{description}</p>
              </div>
<<<<<<< ours
              <StatusPill status={status} />
=======
              <StatusPill status={toStatusPill(status)} label={formatStatusText(status)} />
>>>>>>> theirs
            </div>
          );
        })}
      </div>
    </section>
  );
}
