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
    </span>
  );
}

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
