"use client";

import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

export type StatusPillStatus =
  | "enabled"
  | "healthy"
  | "ok"
  | "configRequired"
  | "notYetExercised"
  | "blocking"
  | "warning"
  | "warn"
  | "error"
  | "off"
  | "unknown"
  | "idle"
  | "waiting"
  | "fault"
  | "disabled";

type StatusTone = "healthy" | "idle" | "waiting" | "fault" | "disabled";

const toneStyles: Record<StatusTone, string> = {
  healthy:
    "border-emerald-200 bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200 dark:border-emerald-500/50 dark:bg-emerald-900/60 dark:text-emerald-50 dark:ring-emerald-500/60",
  idle:
    "border-blue-200 bg-blue-100 text-blue-900 ring-1 ring-blue-200 dark:border-blue-500/50 dark:bg-blue-900/60 dark:text-blue-50 dark:ring-blue-500/60",
  waiting:
    "border-amber-200 bg-amber-100 text-amber-900 ring-1 ring-amber-200 dark:border-amber-500/50 dark:bg-amber-900/60 dark:text-amber-50 dark:ring-amber-500/60",
  fault:
    "border-rose-200 bg-rose-100 text-rose-900 ring-1 ring-rose-200 dark:border-rose-500/50 dark:bg-rose-900/60 dark:text-rose-50 dark:ring-rose-500/60",
  disabled:
    "border-slate-200 bg-slate-100 text-slate-800 ring-1 ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:ring-slate-600",
};

const statusConfig: Record<StatusPillStatus, { tone: StatusTone; label: string }> = {
  enabled: { tone: "idle", label: "Idle" },
  idle: { tone: "idle", label: "Idle" },
  healthy: { tone: "healthy", label: "Healthy" },
  ok: { tone: "healthy", label: "Healthy" },
  configRequired: { tone: "waiting", label: "Config required" },
  notYetExercised: { tone: "idle", label: "Not yet exercised" },
  blocking: { tone: "fault", label: "Blocking" },
  warning: { tone: "waiting", label: "Warning" },
  warn: { tone: "waiting", label: "Warning" },
  waiting: { tone: "waiting", label: "Warning" },
  error: { tone: "fault", label: "Fault" },
  fault: { tone: "fault", label: "Fault" },
  off: { tone: "disabled", label: "Disabled" },
  disabled: { tone: "disabled", label: "Disabled" },
  unknown: { tone: "disabled", label: "Unknown" },
};

const accentPalette: Record<StatusTone, string> = {
  healthy: "rgba(16, 185, 129, 0.32)",
  idle: "rgba(59, 130, 246, 0.32)",
  waiting: "rgba(245, 158, 11, 0.32)",
  fault: "rgba(244, 63, 94, 0.32)",
  disabled: "rgba(148, 163, 184, 0.32)",
};

function resolveTone(status: StatusPillStatus): StatusTone {
  return statusConfig[status]?.tone ?? "disabled";
}

export function StatusPill({ status, label }: { status: StatusPillStatus; label?: string }) {
  const [isAnimating, setIsAnimating] = useState(false);
  const previousStatus = useRef<StatusPillStatus | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const tone = resolveTone(status);
  const displayLabel = label ?? statusConfig[status]?.label ?? "Status";

  useEffect(() => {
    if (prefersReducedMotion) {
      previousStatus.current = status;
      setIsAnimating(false);
      return;
    }

    if (!previousStatus.current || previousStatus.current !== status) {
      setIsAnimating(true);
      previousStatus.current = status;

      const timeout = setTimeout(() => setIsAnimating(false), 200);

      return () => clearTimeout(timeout);
    }

    previousStatus.current = status;
  }, [status, prefersReducedMotion]);

  return (
    <span
      className={`inline-flex items-center gap-2.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold ${toneStyles[tone]} ${
        isAnimating ? "status-change-animate" : ""
      }`}
      style={{
        ["--status-accent" as string]: accentPalette[tone],
      }}
      role="status"
      aria-live="polite"
      aria-label={`${displayLabel} status`}
    >
      <span className={`h-2 w-2 rounded-full bg-current ${isAnimating ? "status-dot-animate" : ""}`} aria-hidden />
      <span className="leading-tight">{displayLabel}</span>
    </span>
  );
}
