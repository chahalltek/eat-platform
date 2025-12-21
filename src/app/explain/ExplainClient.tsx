"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { EmptyState, ErrorStatePanel } from "@/components/states/StatePanels";

export type ExplainJobOption = {
  id: string;
  title: string;
  customer?: string | null;
  location?: string | null;
  candidates: Array<{ id: string; name: string }>;
};

type ExplainResult = {
  candidateId: string;
  summary: string;
  reasons: unknown;
};

export function ExplainClient({
  jobs,
  initialJobId,
  initialCandidateId,
  initialResults,
  rbacWarning,
}: {
  jobs: ExplainJobOption[];
  initialJobId?: string | null;
  initialCandidateId?: string | null;
  initialResults: ExplainResult[];
  rbacWarning?: string | null;
}) {
  const [jobId, setJobId] = useState<string | null>(initialJobId ?? null);
  const [candidateId, setCandidateId] = useState<string | null>(initialCandidateId ?? null);
  const [results, setResults] = useState<ExplainResult[]>(initialResults);
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
    if (!jobId || !candidateId) return;

    setIsRunning(true);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateIds: [candidateId] }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? `Explain failed with ${response.status}`);
      }

      const normalized: ExplainResult[] = Array.isArray(payload.explanations)
        ? payload.explanations.map((item: any) => ({
            candidateId: item.candidateId ?? candidateId,
            summary: item.explanation?.summary ?? "No summary returned",
            reasons: item.explanation,
          }))
        : [];

      setResults(normalized);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Explain run failed";
      setError(message);
    } finally {
      setIsRunning(false);
    }
  }, [candidateId, jobId]);

  if (rbacWarning) {
    return <ErrorStatePanel title="Access restricted" message={rbacWarning} diagnosticsHref="/" />;
  }

  if (!jobs.length) {
    return (
      <EmptyState
        title="No jobs available"
        description="Create a job intake to request explanations."
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
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Explain</p>
            <h1 className="text-2xl font-semibold text-slate-900">Explain match rationale</h1>
            <p className="text-sm text-slate-600">Select a job and candidate to generate a recruiter-facing explanation.</p>
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
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="candidate-picker">
                Candidate
              </label>
              <select
                id="candidate-picker"
                value={candidateId ?? ""}
                onChange={(event) => setCandidateId(event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                disabled={!candidateOptions.length}
              >
                <option value="" disabled>
                  {candidateOptions.length ? "Choose candidate" : "No candidates"}
                </option>
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
              disabled={!jobId || !candidateId || isRunning}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
            >
              {isRunning ? "Running…" : "Run Explain"}
            </button>
          </div>
        </div>
        {error ? (
          <div className="mt-3">
            <ErrorStatePanel title="Explain failed" message={error} onRetry={handleRun} errorDetails={error} />
          </div>
        ) : null}
      </div>

      {results.length === 0 ? (
        <EmptyState title="Select job + candidate" description="Choose a job and candidate then run Explain." />
      ) : (
        <div className="space-y-3">
          {results.map((result) => (
            <div key={result.candidateId} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Candidate</p>
                  <p className="text-lg font-semibold text-slate-900">{result.candidateId}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                  Explain result
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-700">{result.summary}</p>
              <details className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Raw JSON
                </summary>
                <pre className="mt-2 overflow-auto rounded bg-white px-3 py-2 text-xs text-slate-800">
                  {JSON.stringify(result.reasons, null, 2)}
                </pre>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
