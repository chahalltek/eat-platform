'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { JobMatchesTable, JobMatchRow } from './JobMatchesTable';

type Props = {
  jobId: string;
  initialData: JobMatchRow[];
};

export function JobMatchesView({ jobId, initialData }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRunningMatcher, setIsRunningMatcher] = useState(false);
  const [isRunningExplain, setIsRunningExplain] = useState(false);
  const [isRunningShortlist, setIsRunningShortlist] = useState(false);
  const [showShortlistedOnly, setShowShortlistedOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function callJobAgent(
    path: 'matcher' | 'explain' | 'shortlist',
    body: Record<string, unknown> = {}
  ) {
    const res = await fetch(`/api/jobs/${jobId}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.error || `${path} failed with ${res.status}`);
    }
  }

  async function handleRunMatcher() {
    setError(null);
    setIsRunningMatcher(true);
    try {
      await callJobAgent('matcher', {});
      startTransition(() => router.refresh());
    } catch (e) {
      console.error('Run matcher failed', e);
      setError(
        e instanceof Error ? e.message : 'Failed to run matcher. Please try again.'
      );
    } finally {
      setIsRunningMatcher(false);
    }
  }

  async function handleRunExplain() {
    setError(null);
    setIsRunningExplain(true);
    try {
      await callJobAgent('explain', { maxMatches: 20 });
      startTransition(() => router.refresh());
    } catch (e) {
      console.error('Run explain failed', e);
      setError(
        e instanceof Error ? e.message : 'Failed to generate explanations.'
      );
    } finally {
      setIsRunningExplain(false);
    }
  }

  async function handleRunShortlist() {
    setError(null);
    setIsRunningShortlist(true);
    try {
      await callJobAgent('shortlist');
      startTransition(() => router.refresh());
    } catch (e) {
      console.error('Run shortlist failed', e);
      setError(
        e instanceof Error ? e.message : 'Failed to run shortlist. Please try again.'
      );
    } finally {
      setIsRunningShortlist(false);
    }
  }

  const busyMatcher = isRunningMatcher || isPending;
  const busyExplain = isRunningExplain || isPending;
  const busyShortlist = isRunningShortlist || isPending;

  const visibleData = useMemo(
    () =>
      showShortlistedOnly
        ? initialData.filter((row) => row.shortlisted)
        : initialData,
    [initialData, showShortlistedOnly]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Matches</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRunMatcher}
            disabled={busyMatcher}
            className="inline-flex items-center rounded-md border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busyMatcher ? 'Running Matcher…' : 'Run Matcher'}
          </button>
          <button
            type="button"
            onClick={handleRunExplain}
            disabled={busyExplain}
            className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
          >
            {busyExplain ? 'Generating Why…' : 'Run Explain'}
          </button>
          <button
            type="button"
            onClick={handleRunShortlist}
            disabled={busyShortlist}
            className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-900 disabled:opacity-60"
          >
            {busyShortlist ? 'Running Shortlist…' : 'Run Shortlist'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            checked={showShortlistedOnly}
            onChange={(e) => setShowShortlistedOnly(e.target.checked)}
          />
          Shortlisted only
        </label>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <JobMatchesTable data={visibleData} />

      <p className="text-xs text-slate-500">
        Run Matcher to recompute candidate matches for this job. Run Explain to
        generate recruiter-friendly reasons for each match.
      </p>
    </div>
  );
}
