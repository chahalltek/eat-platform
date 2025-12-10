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
  | "unknown";

type StatusTone = "success" | "warning" | "danger" | "neutral";

const toneStyles: Record<StatusTone, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200",
  warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200",
  danger: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200",
  neutral: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

const accentPalette: Record<StatusTone, string> = {
  success: "rgba(16, 185, 129, 0.32)",
  warning: "rgba(245, 158, 11, 0.32)",
  danger: "rgba(244, 63, 94, 0.32)",
  neutral: "rgba(148, 163, 184, 0.32)",
};

const defaultLabels: Record<StatusPillStatus, string> = {
  enabled: "Enabled",
  healthy: "Healthy",
  ok: "Healthy",
  warning: "Setup required",
  warn: "Attention needed",
  error: "Unavailable",
  off: "Disabled",
  unknown: "Status unknown",
};

function resolveTone(status: StatusPillStatus): StatusTone {
  switch (status) {
    case "enabled":
    case "healthy":
    case "ok":
      return "success";
    case "warning":
    case "warn":
      return "warning";
    case "error":
    case "off":
      return "danger";
    default:
      return "neutral";
  }
}

export function StatusPill({ status, label }: { status: StatusPillStatus; label?: string }) {
  const [isAnimating, setIsAnimating] = useState(false);
  const previousStatus = useRef<StatusPillStatus | null>(null);

  const tone = resolveTone(status);
  const displayLabel = label ?? defaultLabels[status];

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
    >
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${isAnimating ? "status-dot-animate" : ""}`} aria-hidden />
      <span className="whitespace-nowrap">{displayLabel}</span>
    </span>
  );
}
