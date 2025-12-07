"use client";

import { useState, useTransition } from "react";

import { JobCandidateStatus } from "@prisma/client";

const STATUS_OPTIONS: JobCandidateStatus[] = [
  JobCandidateStatus.POTENTIAL,
  JobCandidateStatus.SHORTLISTED,
  JobCandidateStatus.SUBMITTED,
  JobCandidateStatus.INTERVIEWING,
  JobCandidateStatus.HIRED,
  JobCandidateStatus.REJECTED,
];

function formatStatus(status: JobCandidateStatus) {
  return status
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function JobCandidateStatusControl({
  jobCandidateId,
  initialStatus,
}: {
  jobCandidateId: string;
  initialStatus: JobCandidateStatus;
}) {
  const [status, setStatus] = useState<JobCandidateStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (nextStatus: JobCandidateStatus) => {
    if (nextStatus === status) return;

    const previousStatus = status;
    setStatus(nextStatus);
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/job-candidate/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobCandidateId, status: nextStatus }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setStatus(previousStatus);
        setError(data?.error ?? "Failed to update status");
        return;
      }

      const data = (await response.json().catch(() => null)) as { status?: JobCandidateStatus } | null;
      if (data?.status) {
        setStatus(data.status);
      }
    });
  };

  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-gray-700">{formatStatus(status)}</div>
      <div className="flex items-center space-x-2">
        <select
          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={status}
          disabled={isPending}
          onChange={(event) => handleStatusChange(event.target.value as JobCandidateStatus)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {formatStatus(option)}
            </option>
          ))}
        </select>
        {isPending ? <span className="text-xs text-gray-500">Saving…</span> : null}
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
