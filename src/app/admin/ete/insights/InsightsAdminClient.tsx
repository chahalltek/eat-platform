'use client';

import type React from 'react';
import { useMemo, useState, useTransition } from 'react';

import type { BenchmarkRelease } from '@/lib/publishing/releaseRegistry';
import type { InsightSnapshotRecord } from '@/lib/publishing/insightSnapshots';

const AUDIENCE_OPTIONS: InsightSnapshotRecord['audience'][] = ['internal', 'client', 'public'];

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function StatusBadge({ status }: { status: InsightSnapshotRecord['status'] }) {
  const style =
    status === 'published'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'approved'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-sky-50 text-sky-700';

  const label = status === 'draft' ? 'Draft' : status === 'approved' ? 'Approved' : 'Published';

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style}`}>{label}</span>;
}

type SnapshotFormState = {
  releaseId: string;
  templateKey: string;
  audience: InsightSnapshotRecord['audience'];
  roleFamily: string;
  industry: string;
  region: string;
};

export function InsightsAdminClient({
  initialSnapshots,
  releases,
  storageError,
  benchmarksUnavailable,
}: {
  initialSnapshots: InsightSnapshotRecord[];
  releases: BenchmarkRelease[];
  storageError?: string | null;
  benchmarksUnavailable?: boolean;
}) {
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const initialReleaseId = releases[0]?.id ?? '';
  const [formState, setFormState] = useState<SnapshotFormState>({
    releaseId: initialReleaseId,
    templateKey: 'scarcity-index',
    audience: 'internal',
    roleFamily: '',
    industry: '',
    region: '',
  });

  const statusCounts = useMemo(() => {
    return snapshots.reduce(
      (acc, snapshot) => {
        acc[snapshot.status] = (acc[snapshot.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<InsightSnapshotRecord['status'], number>,
    );
  }, [snapshots]);

  async function refreshSnapshots() {
    const response = await fetch('/api/admin/ete/insights');
    if (!response.ok) {
      throw new Error('Unable to refresh snapshot list');
    }
    const data = await response.json();
    setSnapshots(data.snapshots ?? []);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const payload = {
      releaseId: formState.releaseId,
      templateKey: formState.templateKey,
      audience: formState.audience,
      filters: {
        roleFamily: formState.roleFamily || undefined,
        industry: formState.industry || undefined,
        region: formState.region || undefined,
      },
    };

    try {
      const response = await fetch('/api/admin/ete/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? 'Unable to create snapshot');
      }

      startTransition(() => {
        refreshSnapshots().catch((refreshError) => setError(refreshError.message));
      });
    } catch (creationError) {
      setError((creationError as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAction(id: string, action: 'approve' | 'publish') {
    setError(null);
    try {
      const response = await fetch(`/api/admin/ete/insights/${id}/${action}`, { method: 'PUT' });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? 'Unable to update snapshot');
      }

      startTransition(() => {
        refreshSnapshots().catch((refreshError) => setError(refreshError.message));
      });
    } catch (actionError) {
      setError((actionError as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Snapshots</p>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Insight snapshot builder</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Convert benchmark releases into CSV and PDF-ready JSON artifacts. Approvals are required before publishing.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-100">
              Drafts
              <div className="text-2xl">{statusCounts.draft ?? 0}</div>
            </div>
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-100">
              Approved
              <div className="text-2xl">{statusCounts.approved ?? 0}</div>
            </div>
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100">
              Published
              <div className="text-2xl">{statusCounts.published ?? 0}</div>
            </div>
          </div>
        </div>
        {storageError ? (
          <p className="mt-3 text-sm text-amber-700">{storageError}</p>
        ) : null}
        {benchmarksUnavailable ? (
          <p className="mt-3 text-sm text-amber-700">Benchmark data unavailable. Publish a release to enable insights.</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Create a snapshot</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Pick a published benchmark release and generate a draft snapshot. All content stays tenant-anonymized.
        </p>

        <form onSubmit={handleCreate} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Benchmark release
            <select
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              value={formState.releaseId}
              onChange={(event) => setFormState((prev) => ({ ...prev, releaseId: event.target.value }))}
              required
              disabled={benchmarksUnavailable}
            >
              <option value="" disabled>
                Select a published release
              </option>
              {releases.map((release) => (
                <option key={release.id} value={release.id}>
                  {release.title}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Template
            <select
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              value={formState.templateKey}
              onChange={(event) => setFormState((prev) => ({ ...prev, templateKey: event.target.value }))}
            >
              <option value="scarcity-index">Scarcity index</option>
              <option value="time-to-fill">Time to fill</option>
              <option value="market-heatmap">Market heatmap</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Audience
            <select
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              value={formState.audience}
              onChange={(event) => setFormState((prev) => ({ ...prev, audience: event.target.value as SnapshotFormState['audience'] }))}
            >
              {AUDIENCE_OPTIONS.map((audience) => (
                <option key={audience} value={audience}>
                  {audience}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:col-span-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Role family (optional)
              <input
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                value={formState.roleFamily}
                onChange={(event) => setFormState((prev) => ({ ...prev, roleFamily: event.target.value }))}
                placeholder="Data, Engineering, Sales"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Industry (optional)
              <input
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                value={formState.industry}
                onChange={(event) => setFormState((prev) => ({ ...prev, industry: event.target.value }))}
                placeholder="Healthcare, SaaS"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Region (optional)
              <input
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                value={formState.region}
                onChange={(event) => setFormState((prev) => ({ ...prev, region: event.target.value }))}
                placeholder="Midwest, EMEA"
              />
            </label>
          </div>

          <div className="md:col-span-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Snapshots start as drafts and must be approved before publishing.
            </div>
            <button
              type="submit"
              disabled={
                isSubmitting || !formState.releaseId || Boolean(storageError) || Boolean(benchmarksUnavailable)
              }
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Creating…' : 'Generate snapshot'}
            </button>
          </div>
        </form>

        {error ? <p className="mt-3 text-sm text-amber-700">{error}</p> : null}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Snapshot queue</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Approve, publish, and export CSV or JSON artifacts.</p>
          </div>
          {isPending ? <span className="text-xs text-zinc-500">Refreshing…</span> : null}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Release</th>
                <th className="px-3 py-2">Audience</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Published</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {snapshots.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-zinc-500">
                    {storageError ? storageError : 'No snapshots yet. Generate a draft to start the workflow.'}
                  </td>
                </tr>
              ) : (
                snapshots.map((snapshot) => (
                  <tr key={snapshot.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-50">{snapshot.title}</div>
                      <div className="text-xs text-zinc-500">{snapshot.contentJson.chart.series[0]?.label ?? snapshot.releaseId}</div>
                    </td>
                    <td className="px-3 py-3 text-zinc-700 dark:text-zinc-200">{snapshot.releaseId}</td>
                    <td className="px-3 py-3 text-zinc-700 dark:text-zinc-200">{snapshot.audience}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={snapshot.status} />
                    </td>
                    <td className="px-3 py-3 text-zinc-700 dark:text-zinc-200">{formatDate(snapshot.createdAt)}</td>
                    <td className="px-3 py-3 text-zinc-700 dark:text-zinc-200">{formatDate(snapshot.publishedAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                          disabled={snapshot.status !== 'draft' || Boolean(storageError)}
                          onClick={() => handleAction(snapshot.id, 'approve')}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                          disabled={snapshot.status !== 'approved' || Boolean(storageError)}
                          onClick={() => handleAction(snapshot.id, 'publish')}
                        >
                          Publish
                        </button>
                        <a
                          className="text-xs font-semibold text-indigo-700 underline dark:text-indigo-300"
                          href={`/api/admin/ete/insights/${snapshot.id}/export.csv`}
                        >
                          CSV
                        </a>
                        <a
                          className="text-xs font-semibold text-indigo-700 underline dark:text-indigo-300"
                          href={`/api/admin/ete/insights/${snapshot.id}/export.json`}
                        >
                          JSON
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
