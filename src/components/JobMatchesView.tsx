'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { JobMatchesTable, JobMatchRow } from './JobMatchesTable';

type Props = {
  jobId: string;
  initialData: JobMatchRow[];
};

export function JobMatchesView({ jobId, initialData }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRunMatcher() {
    setError(null);
    setIsRunning(true);

    try {
      const res = await fetch(`/api/jobs/${jobId}/matcher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // recruiterId can be inferred/hardcoded in API for now
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Matcher failed with ${res.status}`);
      }

      // Re-fetch server data
      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      console.error('Run matcher failed', e);
      setError(
        e instanceof Error ? e.message : 'Failed to run matcher. Please try again.'
      );
    } finally {
      setIsRunning(false);
    }
  }

  const isBusy = isRunning || isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Matches</h1>
        <button
          type="button"
          onClick={handleRunMatcher}
          disabled={isBusy}
          className="inline-flex items-center rounded-md border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isBusy ? 'Running…' : 'Run Matcher'}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <JobMatchesTable data={initialData} />

      <p className="text-xs text-slate-500">
        This view shows the latest stored matches for this job. Click “Run Matcher”
        to recompute matches and refresh the table.
      </p>
    </div>
  );
}
