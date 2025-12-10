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
