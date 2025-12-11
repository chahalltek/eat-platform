"use client";

import { useEffect, useRef, useState } from "react";

export type StatusPillStatus =
  | "enabled"
  | "healthy"
  | "ok"
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
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200",
  idle: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200",
  waiting:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200",
  fault: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200",
  disabled: "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
};

const statusConfig: Record<StatusPillStatus, { tone: StatusTone; label: string }> = {
  enabled: { tone: "idle", label: "Idle" },
  idle: { tone: "idle", label: "Idle" },
  healthy: { tone: "healthy", label: "Healthy" },
  ok: { tone: "healthy", label: "Healthy" },
  warning: { tone: "waiting", label: "Waiting" },
  warn: { tone: "waiting", label: "Waiting" },
  waiting: { tone: "waiting", label: "Waiting" },
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

  const tone = resolveTone(status);
  const displayLabel = label ?? statusConfig[status]?.label ?? "Status";

  useEffect(() => {
    if (previousStatus.current && previousStatus.current !== status) {
      setIsAnimating(false);
      const raf = requestAnimationFrame(() => setIsAnimating(true));
      const timeout = setTimeout(() => setIsAnimating(false), 900);

      previousStatus.current = status;

      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timeout);
      };
    }

    previousStatus.current = status;
  }, [status]);

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${toneStyles[tone]} ${
        isAnimating ? "status-change-animate" : ""
      }`}
      style={{
        ["--status-accent" as string]: accentPalette[tone],
      }}
      role="status"
      aria-live="polite"
      aria-label={`${displayLabel} status`}
    >
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${isAnimating ? "status-dot-animate" : ""}`} aria-hidden />
      <span className="whitespace-nowrap">{displayLabel}</span>
    </span>
  );
}
