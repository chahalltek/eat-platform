"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { StatusPill, type StatusPillStatus } from "@/components/StatusPill";
import type { SubsystemKey, SubsystemState, SystemStatusMap } from "@/lib/systemStatus";

const statusLabels: Record<SubsystemKey, string> = {
  agents: "Agents",
  scoring: "Scoring Engine",
  database: "Database",
  tenantConfig: "Tenant Config",
};

const statusDescriptions: Record<SubsystemKey, string> = {
  agents: "Orchestration for agent workflows.",
  scoring: "Automated scoring pipeline.",
  database: "Primary datastore availability.",
  tenantConfig: "Feature flags and tenant settings.",
};

function formatStatusText(status: SubsystemState) {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Waiting";
    case "error":
      return "Fault";
    default:
      return "Status unavailable";
  }
}

function toStatusPill(status: SubsystemState): StatusPillStatus {
  switch (status) {
    case "healthy":
      return "healthy";
    case "warning":
      return "warning";
    case "error":
      return "error";
    case "unknown":
    default:
      return "unknown";
  }
}

type SystemStatusProps = {
  statusMap: SystemStatusMap;
  onRefresh: () => void;
  isRefreshing: boolean;
};

export function SystemStatus({ statusMap, onRefresh, isRefreshing }: SystemStatusProps) {
  const [shouldPulse, setShouldPulse] = useState(true);
  const pulseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerPulse = useCallback(() => {
    if (pulseTimeoutRef.current) {
      clearTimeout(pulseTimeoutRef.current);
    }

    setShouldPulse(true);
    pulseTimeoutRef.current = setTimeout(() => setShouldPulse(false), 900);
  }, []);

  useEffect(() => {
    triggerPulse();

    return () => {
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
      }
    };
  }, [triggerPulse]);

 )

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-violet-600">SYSTEM STATUS</p>
          <p className="text-sm text-slate-500">Live health for EAT subsystems.</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(statusLabels) as SubsystemKey[]).map((key, index) => {
          const entry = statusMap[key];
          const status = entry?.status ?? "unknown";
          const description = entry?.detail ?? statusDescriptions[key];

          return (
            <div
              key={key}
              className={`flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 ${
                shouldPulse ? "telemetry-pulse" : ""
              }`}
              style={shouldPulse ? { animationDelay: `${index * 80}ms` } : undefined}
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{statusLabels[key]}</p>
                <p className="text-xs text-slate-500">{description}</p>
              </div>
              <StatusPill status={toStatusPill(status)} label={formatStatusText(status)} />
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes telemetryPulse {
          0% {
            transform: translateY(0);
            box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.08);
          }
          35% {
            transform: translateY(-1px);
            box-shadow: 0 12px 30px -18px rgba(79, 70, 229, 0.18);
          }
          100% {
            transform: translateY(0);
            box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.08);
          }
        }

        .telemetry-pulse {
          animation: telemetryPulse 1s ease-out;
        }
      `}</style>
    </section>
  );
}
