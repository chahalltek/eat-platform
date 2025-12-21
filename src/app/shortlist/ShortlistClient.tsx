"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { EmptyState, ErrorStatePanel } from "@/components/states/StatePanels";

export type ShortlistJobOption = {
  id: string;
  title: string;
  customer?: string | null;
  location?: string | null;
  candidates: Array<{ id: string; name: string }>;
};

type ShortlistRow = {
  candidateId: string;
  score: number | null;
  confidenceBand: string | null;
  reason: string;
};

export function ShortlistClient({
  jobs,
  initialJobId,
  initialResults,
  rbacWarning,
}: {
  jobs: ShortlistJobOption[];
  initialJobId?: string | null;
  initialResults: ShortlistRow[];
  rbacWarning?: string | null;
}) {
  const [jobId, setJobId] = useState<string | null>(initialJobId ?? null);
  const [results, setResults] = useState<ShortlistRow[]>(initialResults);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === jobId) ?? null, [jobs, jobId]);

  useEffect(() => {
    setJobId(initialJobId ?? null);
    setResults(initialResults);
  }, [initialJobId, initialResults]);

  const handleRun = useCallback(async () => {
    if (!jobId) return;

    setIsRunning(true);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}/shortlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortlistLimit: 10 }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? `Shortlist failed with ${response.status}`);
      }

      const normalized: ShortlistRow[] = Array.isArray(payload.shortlistedCandidates)
        ? payload.shortlistedCandidates.map((item: any) => ({
            candidateId: item.candidateId ?? "unknown",
            score: item.score ?? null,
            confidenceBand: item.confidenceBand ?? null,
            reason: item.shortlistReason ?? "Recommended for submission",
          }))
        : [];

      setResults(normalized);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Shortlist run failed";
      setError(message);
    } finally {
      setIsRunning(false);
    }
  }, [jobId]);

  const handleDownload = useCallback(() => {
    if (!results.length) return;
    const lines = [
      ["Candidate ID", "Score", "Confidence", "Reason"].join(","),
      ...results.map((row) =>
        [row.candidateId, row.score ?? "", row.confidenceBand ?? "", row.reason?.replace(/,/g, ";") ?? ""].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shortlist_${jobId ?? "job"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [jobId, results]);

  const handleCopy = useCallback(async () => {
    if (!results.length) return;
    try {
      const header = "| Candidate | Score | Confidence | Reason |";
      const divider = "| --- | --- | --- | --- |";
      const rows = results.map(
        (row) => `| ${row.candidateId} | ${row.score ?? "—"} | ${row.confidenceBand ?? "—"} | ${row.reason} |`,
      );
      const text = ["Shortlist", "", header, divider, ...rows, ""].join("\n");
      await navigator.clipboard.writeText(text);
      setError(null);
    } catch (err) {
      setError("Clipboard unavailable. Copy manually.");
    }
  }, [results]);

  if (rbacWarning) {
    return <ErrorStatePanel title="Access restricted" message={rbacWarning} diagnosticsHref="/" />;
  }

  if (!jobs.length) {
    return (
      <EmptyState
        title="No jobs available"
        description="Create a job intake to request shortlist recommendations."
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
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Shortlist</p>
            <h1 className="text-2xl font-semibold text-slate-900">Export-ready shortlist</h1>
            <p className="text-sm text-slate-600">Run shortlist and export as CSV or clipboard table.</p>
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
            <button
              type="button"
              onClick={handleRun}
              disabled={!jobId || isRunning}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {isRunning ? "Shortlisting…" : "Run Shortlist"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!results.length}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!results.length}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              Copy to clipboard
            </button>
          </div>
        </div>
        {error ? (
          <div className="mt-3">
            <ErrorStatePanel title="Shortlist failed" message={error} onRetry={handleRun} errorDetails={error} />
          </div>
        ) : null}
      </div>

      {results.length === 0 ? (
        <EmptyState title="Run Shortlist." description="Kick off shortlist to see recommendations." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Candidate</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Score</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Confidence</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {results.map((row) => (
                <tr key={row.candidateId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.candidateId}</td>
                  <td className="px-4 py-3 text-sm text-slate-800">{row.score ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-800">{row.confidenceBand ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
