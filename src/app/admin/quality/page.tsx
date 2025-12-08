import { ArrowTrendingDownIcon, ArrowTrendingUpIcon, BeakerIcon, BugAntIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

import { getCurrentUser } from '@/lib/auth/user';
import { getQualityMetrics } from '@/lib/metrics/quality';

export const dynamic = 'force-dynamic';

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  description?: string;
  icon: typeof BeakerIcon;
  accent?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl ${
          accent ?? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200'
        }`}
      >
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
        {description ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p> : null}
      </div>
    </div>
  );
}

function RunVolume({ data }: { data: { label: string; count: number }[] }) {
  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Run counts (14d)</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Daily execution volume from the last two weeks.</p>
        </div>
      </div>
      <div className="flex items-end gap-4 overflow-x-auto pb-1">
        {data.map((item) => {
          const barHeight = `${(item.count / maxCount) * 100}%`;
          return (
            <div key={item.label} className="flex min-w-[52px] flex-1 flex-col items-center gap-2">
              <div className="flex h-32 w-full items-end rounded-xl bg-zinc-100 dark:bg-zinc-800/80">
                <div
                  className="w-full rounded-xl bg-indigo-500 shadow-sm transition-all"
                  style={{ height: barHeight }}
                  aria-label={`${item.label}: ${item.count}`}
                />
              </div>
              <div className="flex flex-col items-center text-center text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-semibold text-zinc-800 dark:text-zinc-100">{item.count}</span>
                <span>{item.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CoverageHistory({ data }: { data: { label: string; percent: number | null }[] }) {
  const effectiveValues = data.map((item) => item.percent ?? 0);
  const maxPercent = Math.max(...effectiveValues, 1);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Coverage history</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Latest coverage per day, rounded to one decimal.</p>
        </div>
      </div>
      <div className="flex items-end gap-4 overflow-x-auto pb-1">
        {data.map((item) => {
          const heightPercent = `${((item.percent ?? 0) / maxPercent) * 100}%`;
          return (
            <div key={item.label} className="flex min-w-[52px] flex-1 flex-col items-center gap-2">
              <div className="flex h-32 w-full items-end rounded-xl bg-zinc-100 dark:bg-zinc-800/80">
                <div
                  className="w-full rounded-xl bg-emerald-500 shadow-sm"
                  style={{ height: heightPercent }}
                  aria-label={`${item.label}: ${item.percent ?? 'no data'}%`}
                />
              </div>
              <div className="flex flex-col items-center text-center text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                  {item.percent !== null ? `${item.percent}%` : '—'}
                </span>
                <span>{item.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgentFailureTable({
  data,
}: {
  data: { agentName: string; failureRate: number; failedRuns: number; totalRuns: number }[];
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Agent failure %</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Breakdown of failed executions by agent name.</p>
        </div>
        <ShieldExclamationIcon className="h-6 w-6 text-amber-500" aria-hidden />
      </div>
      <div className="mt-4 divide-y divide-zinc-100 text-sm text-zinc-700 dark:divide-zinc-800 dark:text-zinc-200">
        {data.length === 0 ? (
          <p className="py-2 text-zinc-500 dark:text-zinc-400">No recent runs to summarize.</p>
        ) : (
          data.map((row) => (
            <div key={row.agentName} className="flex items-center justify-between py-3">
              <div className="flex flex-col">
                <span className="font-semibold">{row.agentName}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {row.failedRuns} of {row.totalRuns} runs failed
                </span>
              </div>
              <span className="text-base font-semibold">{row.failureRate.toFixed(1)}%</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) return 'No coverage reports yet';
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function isAdmin(user: { role: string | null } | null) {
  return (user?.role ?? '').toUpperCase() === 'ADMIN';
}

export default async function QualityPage() {
  const user = await getCurrentUser();

  if (!isAdmin(user)) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need an admin role to view release quality metrics. Switch to an admin user to continue.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium text-amber-900 underline">
              Return to home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const metrics = await getQualityMetrics();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 sm:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Admin</p>
            <h1 className="text-3xl font-semibold sm:text-4xl">Release quality</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Coverage, errors, and run outcomes for the last two weeks.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-700/60"
          >
            Return to home
          </Link>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Coverage"
            value={metrics.coverage.latestPercent !== null ? `${metrics.coverage.latestPercent}%` : '—'}
            description={`Last updated: ${formatTimestamp(metrics.coverage.lastUpdated)}`}
            icon={BeakerIcon}
          />
          <StatCard
            label="Run count"
            value={metrics.runs.total}
            description="Agent runs across the last 14 days"
            icon={ArrowTrendingUpIcon}
            accent="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100"
          />
          <StatCard
            label="Errors"
            value={metrics.errors.total}
            description="Failed executions captured"
            icon={BugAntIcon}
            accent="bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-100"
          />
          <StatCard
            label="Agent failure %"
            value={`${metrics.errors.failureRate.toFixed(1)}%`}
            description="Failed runs divided by total runs"
            icon={ArrowTrendingDownIcon}
            accent="bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-100"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <CoverageHistory data={metrics.coverage.history} />
            <RunVolume data={metrics.runs.perDay} />
          </div>
          <div className="flex flex-col gap-6">
            <AgentFailureTable data={metrics.errors.byAgent} />
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-200">
                <ShieldExclamationIcon className="h-5 w-5" aria-hidden />
                <p className="text-sm font-semibold uppercase tracking-[0.2em]">Ingestion</p>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Coverage updates</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Push coverage numbers from CI with <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">POST /api/admin/quality/coverage</code>.
              </p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li>• Send <span className="font-semibold">coveragePercent</span> in the request body.</li>
                <li>• Include <span className="font-semibold">branch</span> and <span className="font-semibold">commitSha</span> to tag reports.</li>
                <li>
                  • Protect the endpoint with <span className="font-semibold">QUALITY_INGEST_TOKEN</span> as a Bearer token.
                </li>
              </ul>
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
                Coverage cards update as soon as a new report arrives.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
