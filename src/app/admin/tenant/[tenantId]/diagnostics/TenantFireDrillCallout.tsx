"use client";

import { useMemo, useState } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";

import type { TenantDiagnostics } from "@/lib/tenant/diagnostics";

export function TenantFireDrillCallout({ fireDrill }: { fireDrill: TenantDiagnostics["fireDrill"] }) {
  const [status, setStatus] = useState(fireDrill);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const note = useMemo(() => {
    if (status.reason) return status.reason;

    return "Incident heuristics were met recently; Fire Drill mode can reduce agent blast radius.";
  }, [status.reason]);

  if (!status.suggested || status.enabled) {
    return null;
  }

  const enableFireDrill = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/tenant/fire_drill", { method: "POST" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ? String(payload.error) : "Unable to enable Fire Drill mode");
      }

      setStatus((prev) => ({ ...prev, enabled: true, suggested: false }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to enable Fire Drill mode";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
      <div className="flex items-start gap-3">
        <ExclamationTriangleIcon className="mt-0.5 h-6 w-6 text-amber-500" aria-hidden />
        <div className="flex-1 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Fire Drill suggested</p>
              <p className="text-sm text-amber-800">
                {note} Reviewed window: last {status.windowMinutes} minutes.
              </p>
            </div>
            <button
              type="button"
              onClick={enableFireDrill}
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-amber-50 shadow hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-amber-300"
            >
              {submitting ? "Switching..." : "Switch to Fire Drill mode"}
            </button>
          </div>
          {error ? <p className="text-sm text-amber-900">Error enabling Fire Drill: {error}</p> : null}
        </div>
      </div>
    </div>
  );
}
