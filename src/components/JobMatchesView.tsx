'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { TS_CONFIG } from '@/config/ts';
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
  const { topN, minMatchScore, minConfidence } = TS_CONFIG.shortlist;
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>(
    'idle'
  );

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
    setCopyStatus('idle');
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
    setCopyStatus('idle');
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
    setCopyStatus('idle');
    setIsRunningShortlist(true);
    try {
      await callJobAgent('shortlist', {
        minMatchScore,
        minConfidence,
        maxShortlisted: topN,
      });
      startTransition(() => router.refresh());
    } catch (e) {
      console.error('Run shortlist failed', e);
      setError(
        e instanceof Error ? e.message : 'Failed to generate shortlist.'
      );
    } finally {
      setIsRunningShortlist(false);
    }
  }

  const busyMatcher = isRunningMatcher || isPending;
  const busyExplain = isRunningExplain || isPending;
  const busyShortlist = isRunningShortlist || isPending;

  const shortlistedRows = useMemo(
    () => initialData.filter((row) => row.shortlisted),
    [initialData]
  );

  const displayData = useMemo(
    () => (showShortlistedOnly ? shortlistedRows : initialData),
    [initialData, shortlistedRows, showShortlistedOnly]
  );

  const hasShortlist = shortlistedRows.length > 0;

  function handleDownloadShortlistCsv() {
    if (shortlistedRows.length === 0) return;

    const headers = [
      'Candidate ID',
      'Candidate Name',
      'Title',
      'Match Score',
      'Confidence',
      'Why (Summary)',
    ];

    const escape = (value: unknown) =>
      `"${String(value ?? '')
        .replace(/"/g, '""')
        .replace(/\r?\n/g, ' ')}"`;

    const rows = shortlistedRows.map((r) => [
      r.candidateId,
      r.candidateName,
      r.candidateTitle ?? '',
      `${r.matchScore}`,
      `${r.confidence}`,
      r.explanationSummary ?? '',
    ]);

    const csvLines = [
      headers.map(escape).join(','),
      ...rows.map((row) => row.map(escape).join(',')),
    ];

    const csvContent = csvLines.join('\r\n');
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `shortlist_${jobId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleCopyShortlistToClipboard() {
    setCopyStatus('idle');
    if (!hasShortlist) return;

    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard API not available');
      }

      const header = [
        'Candidate',
        'Title',
        'Match',
        'Confidence',
        'Why (Summary)',
      ];

      const rows = shortlistedRows.map((r) => [
        r.candidateName,
        r.candidateTitle ?? '',
        `${r.matchScore}%`,
        `${r.confidence}%`,
        r.explanationSummary ?? '',
      ]);

      // Simple markdown-style table for email / Teams / Slack
      const lines: string[] = [];

      lines.push(`Shortlist for Job ${jobId}`);
      lines.push('');
      lines.push(`| ${header.join(' | ')} |`);
      lines.push(`| ${header.map(() => '---').join(' | ')} |`);
      for (const row of rows) {
        lines.push(`| ${row.join(' | ')} |`);
      }
      lines.push('');
      lines.push('_Generated by EAT-TS shortlist (Match + Confidence based)._');

      const text = lines.join('\n');

      await navigator.clipboard.writeText(text);
      setCopyStatus('success');
    } catch (err) {
      console.error('Failed to copy shortlist to clipboard', err);
      setCopyStatus('error');
    }
  }

  return (
    <div className="space-y-4">
      {/* Header + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Matches</h1>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-slate-300"
                checked={showShortlistedOnly}
                onChange={(e) => setShowShortlistedOnly(e.target.checked)}
              />
              <span>Show shortlisted only</span>
            </label>
            <span className="text-slate-400">
              Shortlisted: {shortlistedRows.length}
            </span>
            {copyStatus === 'success' && (
              <span className="text-emerald-600">Copied to clipboard</span>
            )}
            {copyStatus === 'error' && (
              <span className="text-red-600">
                Couldn&apos;t copy (clipboard not available)
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
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
            className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busyShortlist ? 'Shortlisting…' : 'Run Shortlist'}
          </button>

          <button
            type="button"
            onClick={handleDownloadShortlistCsv}
            disabled={!hasShortlist}
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-40"
          >
            Download Shortlist CSV
          </button>

          <button
            type="button"
            onClick={handleCopyShortlistToClipboard}
            disabled={!hasShortlist}
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-40"
          >
            Copy Shortlist to Clipboard
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <JobMatchesTable data={displayData} />

      <p className="text-xs text-slate-500">
        Run Matcher to recompute candidate matches. Run Explain to generate
        recruiter-friendly reasons. Run Shortlist to mark the best candidates for
        submit based on match and confidence, then export them as CSV for client
        sharing or ATS upload. Shortlist selects up to {topN} candidates with at
        least {minMatchScore}% match and {minConfidence}% confidence.
      </p>
    </div>
  );
}
