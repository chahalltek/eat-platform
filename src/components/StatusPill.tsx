<<<<<<< ours
<<<<<<< ours
import type { SubsystemState } from "@/lib/systemStatus";

const statusLabels: Record<SubsystemState, string> = {
  healthy: "Healthy",
  warning: "Warning",
  error: "Error",
  unknown: "Unknown",
};

const statusStyles: Record<SubsystemState, string> = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  error: "border-rose-200 bg-rose-50 text-rose-700",
  unknown: "border-slate-200 bg-white text-slate-600",
};

export function StatusPill({ status }: { status: SubsystemState }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
=======
export type Status = "healthy" | "unknown" | "degraded" | "down";

const STATUS_STYLES: Record<Status, string> = {
  healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  unknown: "bg-slate-50 text-slate-600 border-slate-200",
  degraded: "bg-amber-50 text-amber-700 border-amber-200",
  down: "bg-rose-50 text-rose-700 border-rose-200",
};

export function StatusPill({ status, label }: { status: Status; label?: string }) {
  const classes = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium ${classes}`}
    >
      {label ?? labelFromStatus(status)}
=======
type StatusPillStatus = "enabled" | "healthy" | "ok" | "warning" | "warn" | "error" | "off" | "unknown";

type StatusTone = "success" | "warning" | "danger" | "neutral";

const toneStyles: Record<StatusTone, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200",
  warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200",
  danger: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200",
  neutral: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
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
  const tone = resolveTone(status);
  const displayLabel = label ?? defaultLabels[status];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${toneStyles[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      <span className="whitespace-nowrap">{displayLabel}</span>
>>>>>>> theirs
    </span>
  );
}

<<<<<<< ours
function labelFromStatus(status: Status): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "unknown":
      return "Unknown";
    case "degraded":
      return "Degraded";
    case "down":
      return "Down";
  }
}
>>>>>>> theirs
=======
>>>>>>> theirs
