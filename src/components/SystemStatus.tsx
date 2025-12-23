"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";

import { StatusPill, type StatusPillStatus } from "@/components/StatusPill";
import type {
  SubsystemKey,
  SubsystemState,
  SystemExecutionState,
  SystemStatusMap,
} from "@/lib/systemStatusTypes";

const statusLabels: Record<SubsystemKey, string> = {
  agents: "Agents",
  scoring: "Scoring Engine",
  database: "Database",
  guardrails: "Guardrails",
  tenantConfig: "Tenant Config",
};

const statusDescriptions: Record<SubsystemKey, string> = {
  agents: "Feature-enabled automations.",
  scoring: "Scoring engine connected.",
  database: "Primary datastore online.",
  guardrails: "Guardrail configuration loaded.",
  tenantConfig: "Tenant configuration detected.",
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

function statusToneClasses(status: SubsystemState) {
  switch (status) {
    case "healthy":
      return {
        container: "border-emerald-200 bg-emerald-50/80",
        iconColor: "text-emerald-600",
      };
    case "warning":
      return {
        container: "border-amber-200 bg-amber-50/80",
        iconColor: "text-amber-600",
      };
    case "error":
      return {
        container: "border-rose-200 bg-rose-50/80",
        iconColor: "text-rose-600",
      };
    case "unknown":
    default:
      return {
        container: "border-slate-200 bg-slate-50",
        iconColor: "text-slate-500",
      };
  }
}

function statusIcon(status: SubsystemState) {
  switch (status) {
    case "healthy":
      return CheckCircleIcon;
    case "warning":
      return ExclamationTriangleIcon;
    case "error":
      return XCircleIcon;
    case "unknown":
    default:
      return QuestionMarkCircleIcon;
  }
}

type SystemStatusProps = {
  statusMap: SystemStatusMap;
  executionState: SystemExecutionState;
  onRefresh: () => void;
  isRefreshing: boolean;
};

function formatTimestamp(iso: string | null) {
  if (!iso) return "No runs recorded";

  return new Date(iso).toLocaleString();
}

export function SystemStatus({ statusMap, executionState, onRefresh, isRefreshing }: SystemStatusProps) {
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

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600">System Status</p>
          <p className="text-sm text-slate-600">Live telemetry across core infrastructure.</p>
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

      <div className="grid gap-3 lg:grid-cols-2">
        {(Object.keys(statusLabels) as SubsystemKey[]).map((key, index) => {
          const entry = statusMap[key];
          const status = entry?.status ?? "unknown";
          const description = entry?.detail ?? statusDescriptions[key];
          const tone = statusToneClasses(status);
          const Icon = statusIcon(status);

          return (
            <div
              key={key}
              className={`flex gap-3 rounded-xl border p-4 shadow-sm ${tone.container} ${
                shouldPulse ? "telemetry-pulse" : ""
              }`}
              style={shouldPulse ? { animationDelay: `${index * 80}ms` } : undefined}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold shadow-sm ${tone.iconColor}`}
                aria-hidden
              >
                <Icon className="h-5 w-5" />
              </div>

              <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-base font-semibold text-slate-900">{statusLabels[key]}</p>
                  <p className="text-sm text-slate-700">{description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start rounded-lg bg-white/80 px-3 py-2 shadow-inner md:self-center">
                  <StatusPill status={toStatusPill(status)} label={formatStatusText(status)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agents executed today</p>
            <p className="text-lg font-semibold text-slate-900">{executionState.runsToday ?? 0}</p>
          </div>
          <div className="space-y-1 text-right sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last successful run</p>
            <p className="text-sm font-semibold text-slate-900">{formatTimestamp(executionState.latestSuccessAt)}</p>
          </div>
        </div>
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
