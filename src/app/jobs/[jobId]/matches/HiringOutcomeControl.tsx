"use client";

import { useState } from "react";

import { type HiringOutcomeStatus } from "@/lib/hiringOutcomes";

const OUTCOME_OPTIONS: HiringOutcomeStatus[] = ["interviewed", "hired", "rejected"];

function formatOutcome(status: HiringOutcomeStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function HiringOutcomeControl({
  jobId,
  candidateId,
  initialStatus,
}: {
  jobId: string;
  candidateId: string;
  initialStatus?: HiringOutcomeStatus;
}) {
  const [status, setStatus] = useState<HiringOutcomeStatus | null>(initialStatus ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (value: string) => {
    if (!value) {
      setStatus(null);
      return;
    }

    const nextStatus = value as HiringOutcomeStatus;

    if (nextStatus === status) {
      return;
    }

    void saveOutcome(nextStatus);
  };

  const saveOutcome = async (nextStatus: HiringOutcomeStatus) => {
    const previousStatus = status;
    setStatus(nextStatus);
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/ete/outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, candidateId, status: nextStatus, source: "recruiter" }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to save hiring outcome");
      }

      const payload = (await response.json().catch(() => null)) as { status?: HiringOutcomeStatus } | null;

      if (payload?.status) {
        setStatus(payload.status);
      }
    } catch (error) {
      setStatus(previousStatus ?? null);
      setError(error instanceof Error ? error.message : "Unable to save hiring outcome");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-1 text-sm">
      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600" htmlFor={`hiring-outcome-${jobId}-${candidateId}`}>
        Outcome
      </label>
      <div className="flex items-center gap-2">
        <select
          id={`hiring-outcome-${jobId}-${candidateId}`}
          className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={status ?? ""}
          onChange={(event) => handleChange(event.target.value)}
          disabled={isSaving}
        >
          <option value="">No outcome recorded</option>
          {OUTCOME_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {formatOutcome(option)}
            </option>
          ))}
        </select>
        {isSaving ? <span className="text-xs text-gray-500">Saving…</span> : null}
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
