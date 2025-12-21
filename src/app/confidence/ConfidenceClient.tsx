"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { EmptyState, ErrorStatePanel } from "@/components/states/StatePanels";

export type ConfidenceJobOption = {
  id: string;
  title: string;
  location?: string | null;
  customer?: string | null;
  candidates: Array<{ id: string; name: string }>;
};

type ConfidenceResult = {
  candidateId: string;
  score: number | null;
  band: string | null;
  reasons: string[];
};

export function ConfidenceClient({
  jobs,
  initialJobId,
  initialCandidateId,
  initialResults,
  rbacWarning,
}: {
  jobs: ConfidenceJobOption[];
  initialJobId?: string | null;
  initialCandidateId?: string | null;
  initialResults: ConfidenceResult[];
  rbacWarning?: string | null;
}) {
  const [jobId, setJobId] = useState<string | null>(initialJobId ?? null);
  const [candidateId, setCandidateId] = useState<string | null>(initialCandidateId ?? null);
  const [results, setResults] = useState<ConfidenceResult[]>(initialResults);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === jobId) ?? null, [jobs, jobId]);
  const candidateOptions = selectedJob?.candidates ?? [];

  useEffect(() => {
    setJobId(initialJobId ?? null);
    setCandidateId(initialCandidateId ?? null);
    setResults(initialResults);
  }, [initialCandidateId, initialJobId, initialResults]);

  const handleRun = useCallback(async () => {
    if (!jobId) return;

    setIsRunning(true);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}/confidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? `Confidence failed with ${response.status}`);
      }

      const normalized: ConfidenceResult[] = Array.isArray(payload.results)
        ? payload.results.map((item: any) => ({
            candidateId: item.candidateId ?? "unknown",
            score: typeof item.confidenceScore === "number" ? item.confidenceScore : item.score ?? null,
            band: item.confidenceBand ?? null,
            reasons: Array.isArray(item.confidenceReasons) ? item.confidenceReasons : [],
          }))
        : [];

      setResults(normalized);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Confidence run failed";
      setError(message);
    } finally {
      setIsRunning(false);
    }
  }, [jobId]);

  const filteredResults = candidateId ? results.filter((row) => row.candidateId === candidateId) : results;

  if (rbacWarning) {
    return <ErrorStatePanel title="Access restricted" message={rbacWarning} diagnosticsHref="/" />;
  }

  if (!jobs.length) {
    return (
      <EmptyState
        title="No jobs available"
        description="Create a job intake to request confidence assessments."
        action={
          <Link
            href="/jobs/new/intake"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Launch intake
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Confidence</p>
            <h1 className="text-2xl font-semibold text-slate-900">Run confidence checks</h1>
            <p className="text-sm text-slate-600">Capture confidence bands and reasons for a job&rsquo;s matches.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="job-picker">
                Job
              </label>
              <select
                id="job-picker"
                value={jobId ?? ""}
                onChange={(event) => {
                  setJobId(event.target.value);
                  setCandidateId(null);
                  setResults([]);
                  setError(null);
                }}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                <option value="" disabled>
                  Choose job
                </option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="candidate-filter">
                Candidate
              </label>
              <select
                id="candidate-filter"
                value={candidateId ?? ""}
                onChange={(event) => setCandidateId(event.target.value || null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                disabled={!candidateOptions.length}
              >
                <option value="">All</option>
                {candidateOptions.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleRun}
              disabled={!jobId || isRunning}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
            >
              {isRunning ? "Running…" : "Run Confidence"}
            </button>
          </div>
        </div>
        {error ? (
          <div className="mt-3">
            <ErrorStatePanel title="Confidence failed" message={error} onRetry={handleRun} errorDetails={error} />
          </div>
        ) : null}
      </div>

      {filteredResults.length === 0 ? (
        <EmptyState title="Run Confidence to see uncertainty signals." description="Run the agent to populate results." />
      ) : (
        <div className="space-y-3">
          {filteredResults.map((row) => (
            <div key={row.candidateId} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Candidate</p>
                  <p className="text-lg font-semibold text-slate-900">{row.candidateId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                    {row.band ?? "No band"}
                  </span>
                  {typeof row.score === "number" ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                      {Math.round(row.score)}%
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Why low/high</p>
                {row.reasons.length ? (
                  <ul className="list-disc space-y-1 pl-4">
                    {row.reasons.map((reason, index) => (
                      <li key={index}>{reason}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-600">No reasons returned.</p>
                )}
              </div>
              <details className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Raw JSON
                </summary>
                <pre className="mt-2 overflow-auto rounded bg-white px-3 py-2 text-xs text-slate-800">
                  {JSON.stringify(row, null, 2)}
                </pre>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
