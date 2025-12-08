import { ArrowTrendingUpIcon, ChartBarIcon, ExclamationTriangleIcon, UsersIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { getDashboardMetrics } from '@/lib/metrics/dashboard';

export const dynamic = 'force-dynamic';

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: typeof ArrowTrendingUpIcon;
  accent?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accent ?? 'bg-indigo-50 text-indigo-700'} dark:bg-indigo-900/30 dark:text-indigo-200`}>
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div className="flex flex-col">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
      </div>
    </div>
  );
}

function BarChart({
  title,
  data,
  description,
}: {
  title: string;
  description?: string;
  data: { label: string; count: number }[];
}) {
  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
          {description ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
          ) : null}
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

function HorizontalBarList({
  title,
  data,
  description,
}: {
  title: string;
  description?: string;
  data: { agentName: string; count: number }[];
}) {
  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
        {description ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p> : null}
      </div>
      <div className="flex flex-col gap-3">
        {data.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No errors reported for any agents.</p>
        ) : (
          data.map((item) => (
            <div key={item.agentName} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm text-zinc-700 dark:text-zinc-200">
                <span className="font-medium">{item.agentName}</span>
                <span>{item.count}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800/80">
                <div
                  className="h-full rounded-full bg-rose-500"
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                  aria-label={`${item.agentName}: ${item.count} errors`}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 sm:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Dashboard</p>
            <h1 className="text-3xl font-semibold sm:text-4xl">Observability</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Live metrics for agent productivity, outreach, and reliability.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-700/60"
          >
            Return to Home
          </Link>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Matches (7d)" value={metrics.totals.matches} icon={ArrowTrendingUpIcon} />
          <StatCard label="Agent Runs (7d)" value={metrics.totals.agentRuns} icon={UsersIcon} accent="bg-emerald-50 text-emerald-700" />
          <StatCard
            label="Outreach Volume (7d)"
            value={metrics.totals.outreach}
            icon={ChartBarIcon}
            accent="bg-blue-50 text-blue-700"
          />
          <StatCard
            label="Errors"
            value={metrics.totals.errors}
            icon={ExclamationTriangleIcon}
            accent="bg-rose-50 text-rose-700"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <BarChart
              title="Matches per Day"
              description="Daily match creation volume across the last 7 days."
              data={metrics.matchesPerDay}
            />
            <BarChart
              title="Agent Runs"
              description="Number of agent executions started each day."
              data={metrics.agentRunsPerDay}
            />
            <BarChart
              title="Outreach Volume"
              description="Outreach interactions generated per day."
              data={metrics.outreachPerDay}
            />
          </div>
          <div className="flex flex-col gap-6">
            <HorizontalBarList
              title="Errors by Agent"
              description="Failed runs grouped by agent name."
              data={metrics.errorsByAgent}
            />
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">About this view</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Metrics update live from the core data sources (matches, agent runs, outreach interactions). Use this dashboard
                to monitor productivity and reliability at a glance.
              </p>
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
                Covers the trailing 7 days of activity and the latest error breakdown by agent.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
