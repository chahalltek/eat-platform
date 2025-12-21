"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorStatePanel } from "@/components/states/StatePanels";

export type JobOption = {
  id: string;
  title: string;
  customer?: string | null;
  location?: string | null;
};

export type MatchListRow = {
  id: string;
  candidateId: string;
  candidateName: string;
  currentTitle?: string | null;
  score?: number | null;
  confidence?: { score: number | null; band: string | null } | null;
  highlight?: string | null;
};

export function MatchesClient({
  jobs,
  initialJobId,
  initialMatches,
  rbacWarning,
}: {
  jobs: JobOption[];
  initialJobId?: string | null;
  initialMatches: MatchListRow[];
  rbacWarning?: string | null;
}) {
  const router = useRouter();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobId ?? null);
  const [matches, setMatches] = useState<MatchListRow[]>(initialMatches);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const currentJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) ?? null, [jobs, selectedJobId]);

  useEffect(() => {
    setSelectedJobId(initialJobId ?? null);
  }, [initialJobId]);

  useEffect(() => {
    setMatches(initialMatches);
  }, [initialMatches]);

  const handleJobChange = useCallback(
    (nextJobId: string) => {
      setSelectedJobId(nextJobId);
      setSuccessMessage(null);
      setRunError(null);
      setMatches([]);
      router.push(`/matches?jobId=${encodeURIComponent(nextJobId)}`);
    },
    [router],
  );

  const handleRunMatcher = useCallback(async () => {
    if (!selectedJobId) return;

    setIsRunning(true);
    setRunError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/jobs/${selectedJobId}/matcher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topN: 25 }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `Matcher failed with ${response.status}`);
      }

      setSuccessMessage("Matcher run queued. Refreshing results…");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Matcher run failed";
      setRunError(message);
    } finally {
      setIsRunning(false);
    }
  }, [router, selectedJobId]);

  if (rbacWarning) {
    return (
      <ErrorStatePanel
        title="Access restricted"
        message={rbacWarning}
        diagnosticsHref="/"
      />
    );
  }

  if (!jobs.length) {
    return (
      <EmptyState
        title="No jobs available"
        description="Create a job intake to see matches here."
        action={
          <Link href="/jobs/new/intake" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
            Launch intake
          </Link>
        }
      />
    );
  }

  if (!selectedJobId) {
    return (
      <EmptyState
        title="Select a job to view ranked candidates"
        description="Choose a role from the list to load match results."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="job-picker">Job</label>
            <select
              id="job-picker"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              onChange={(event) => handleJobChange(event.target.value)}
              defaultValue=""
            >
              <option value="" disabled>
                Choose a job
              </option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </div>
        }
      />
    );
  }

  const hasMatches = matches.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Match results</p>
            <h1 className="text-2xl font-semibold text-slate-900">{currentJob?.title ?? "Selected job"}</h1>
            <p className="text-sm text-slate-600">
              {currentJob?.customer ? `${currentJob.customer} • ` : null}
              {currentJob?.location ?? "Location not provided"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedJobId}
              onChange={(event) => handleJobChange(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              aria-label="Select job"
            >
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
            <Link
              href={`/jobs/${selectedJobId}`}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              View job
            </Link>
            <button
              type="button"
              onClick={handleRunMatcher}
              disabled={isRunning}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
            >
              {isRunning ? "Running matcher…" : "Run matcher"}
            </button>
          </div>
        </div>
        {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
        {runError ? (
          <ErrorStatePanel
            title="Matcher failed"
            message={runError}
            onRetry={handleRunMatcher}
            errorDetails={runError}
          />
        ) : null}
      </div>

      {hasMatches ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Ranked candidates</h2>
                <p className="text-sm text-slate-600">Explain, measure confidence, or shortlist directly from a row.</p>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{matches.length} candidates</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Candidate</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Confidence</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Highlights</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {matches.map((match) => (
                  <tr key={match.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900">{match.candidateName}</p>
                        <p className="text-xs text-slate-600">{match.currentTitle ?? "Title not provided"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{match.score ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-800">
                      {match.confidence?.band ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                          {match.confidence.band}
                          {typeof match.confidence.score === "number" ? ` • ${Math.round(match.confidence.score)}%` : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Not captured</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {match.highlight ?? "Explain to get recruiter-ready highlights."}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/explain?jobId=${encodeURIComponent(selectedJobId)}&candidateId=${encodeURIComponent(match.candidateId)}`}
                          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Explain
                        </Link>
                        <Link
                          href={`/confidence?jobId=${encodeURIComponent(selectedJobId)}&candidateId=${encodeURIComponent(match.candidateId)}`}
                          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Confidence
                        </Link>
                        <Link
                          href={`/shortlist?jobId=${encodeURIComponent(selectedJobId)}&candidateId=${encodeURIComponent(match.candidateId)}`}
                          className="rounded-md border border-emerald-200 bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          Shortlist
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No matches yet"
          description="Kick off the matcher to populate ranked candidates."
          action={
            <button
              type="button"
              onClick={handleRunMatcher}
              disabled={isRunning}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
            >
              {isRunning ? "Running…" : "Run matcher"}
            </button>
          }
        />
      )}
    </div>
  );
}
