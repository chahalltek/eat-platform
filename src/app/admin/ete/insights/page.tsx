import {
  AcademicCapIcon,
  ArrowTrendingUpIcon,
  BeakerIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PauseCircleIcon,
  ShieldCheckIcon,
  SignalIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";
import { getEteInsightsMetrics } from "@/lib/metrics/eteInsights";

export const dynamic = "force-dynamic";

function AccessDenied() {
  return (
    <ETEClientLayout>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need to be a tenant admin for this workspace to view ETE Insights.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium text-amber-900 underline">
              Return to home
            </Link>
          </div>
        </div>
      </main>
    </ETEClientLayout>
  );
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  description?: string;
  icon: typeof ChartBarIcon;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-100">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
        {description ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p> : null}
      </div>
    </div>
  );
}

function PipelineRunChart({ data }: { data: { label: string; count: number }[] }) {
  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Pipeline runs (7d)</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Daily run counts from the last week.</p>
        </div>
      </div>
      <div className="flex items-end gap-4 overflow-x-auto pb-1">
        {data.map((item) => {
          const heightPercent = `${(item.count / maxCount) * 100}%`;
          return (
            <div key={item.label} className="flex min-w-[52px] flex-1 flex-col items-center gap-2">
              <div className="flex h-32 w-full items-end rounded-xl bg-zinc-100 dark:bg-zinc-800/80">
                <div
                  className="w-full rounded-xl bg-indigo-500 shadow-sm"
                  style={{ height: heightPercent }}
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

function EstimateTrendChart({
  title,
  description,
  unit,
  data,
}: {
  title: string;
  description: string;
  unit: string;
  data: { label: string; value: number; samples: number }[];
}) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
        </div>
      </div>
      <div className="flex items-end gap-4 overflow-x-auto pb-1">
        {data.map((item) => {
          const heightPercent = `${(item.value / maxValue) * 100}%`;
          return (
            <div key={item.label} className="flex min-w-[52px] flex-1 flex-col items-center gap-2">
              <div className="flex h-32 w-full items-end rounded-xl bg-zinc-100 dark:bg-zinc-800/80">
                <div
                  className="w-full rounded-xl bg-emerald-500 shadow-sm"
                  style={{ height: heightPercent }}
                  aria-label={`${item.label}: ${item.value.toFixed(1)} ${unit}`}
                />
              </div>
              <div className="flex flex-col items-center text-center text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                  {item.value.toFixed(1)} {unit}
                </span>
                <span>{item.label}</span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-500">{item.samples} jobs</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BehaviorInsightsCard({
  insights,
}: {
  insights: Awaited<ReturnType<typeof getEteInsightsMetrics>>["recruiterBehavior"];
}) {
  const explanationTotals = Object.entries(insights.explanationOpensByConfidence);
  const overrideTotals = Object.entries(insights.shortlistOverrides.byConfidence);

  const explanationSummary =
    explanationTotals.length === 0
      ? "No expansions captured"
      : explanationTotals
          .map(([band, value]) => `${band}: ${value}`)
          .sort()
          .join(" • ");

  const overrideSummary =
    overrideTotals.length === 0
      ? "No overrides yet"
      : overrideTotals
          .map(([band, value]) => `${band}: ${value}`)
          .sort()
          .join(" • ");

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Behavior (private)</p>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Recruiter learning signals</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Anonymized telemetry from recruiter decisions. Used for defaults tuning only; visible to admins/ops.
          </p>
        </div>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-100">
          Last {insights.windowDays}d
        </span>
      </div>

      <dl className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-1 rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <dt className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Candidate opens</dt>
          <dd className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{insights.candidateOpens}</dd>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Times recruiters expanded matches or confidence details.</p>
        </div>
        <div className="space-y-1 rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <dt className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Explanation expands</dt>
          <dd className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{explanationSummary}</dd>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Confidence bands receiving the most curiosity.</p>
        </div>
        <div className="space-y-1 rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <dt className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Shortlist overrides</dt>
          <dd className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{insights.shortlistOverrides.total}</dd>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            To shortlist: {insights.shortlistOverrides.toShortlist} • Removed: {insights.shortlistOverrides.removedFromShortlist}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Confidence mix: {overrideSummary}</p>
        </div>
        <div className="space-y-1 rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <dt className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Avg. time spent</dt>
          <dd className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {(insights.averageDecisionMs / 1000).toFixed(1)}s
          </dd>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Decision dwell time between opening reasoning and closing.</p>
        </div>
      </dl>
    </div>
  );
}

function ModeBreakdownList({ data }: { data: { mode: string; count: number }[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Match runs by mode</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Comparison of UI vs automated match executions.</p>
        </div>
      </div>
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {data.map((entry) => (
          <div key={entry.mode} className="flex items-center justify-between py-3 text-sm">
            <div className="flex items-center gap-2 capitalize text-zinc-800 dark:text-zinc-100">
              <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
              {entry.mode}
            </div>
            <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{entry.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShortlistDistribution({ data }: { data: { size: number; jobs: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Shortlist size distribution</h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No shortlisted candidates recorded yet.</p>
      </div>
    );
  }

  const maxJobs = Math.max(...data.map((item) => item.jobs), 1);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Shortlist size distribution</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">How many jobs have N shortlisted candidates.</p>
      <div className="mt-4 space-y-3">
        {data.map((item) => {
          const widthPercent = `${(item.jobs / maxJobs) * 100}%`;
          return (
            <div key={item.size} className="space-y-1 text-sm">
              <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-200">
                <span className="font-medium">{item.size} shortlisted</span>
                <span>{item.jobs} jobs</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: widthPercent }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ErrorRateTable({
  data,
}: {
  data: { agentName: string; failedRuns: number; totalRuns: number; errorRate: number }[];
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Error rate by agent</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Failure frequency over the last week.</p>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-300">
            <tr>
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3">Failed</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Error rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
            {data.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">
                  No runs recorded in the last 7 days.
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={row.agentName} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{row.agentName}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200">{row.failedRuns}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200">{row.totalRuns}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200">{(row.errorRate * 100).toFixed(1)}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrendBadge({ value }: { value: number }) {
  const tone = value > 0 ? "text-emerald-600 bg-emerald-50" : value < 0 ? "text-amber-600 bg-amber-50" : "text-zinc-600 bg-zinc-100";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tone} dark:bg-opacity-20`}>
      {value > 0 ? "+" : null}
      {value.toFixed(1)}
      <span className="text-[10px] font-normal uppercase tracking-wide text-current/80">Δ</span>
    </span>
  );
}

function MatchQualityTimeline({
  data,
}: {
  data: { label: string; mqi: number; delta: number; signals: string[]; window: string; samples: number }[];
}) {
  const maxScore = Math.max(...data.map((point) => point.mqi), 1);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm dark:border-indigo-900/60 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            <AcademicCapIcon className="h-4 w-4" aria-hidden />
            Learning
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Match Quality Index (MQI)</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Signals that ETE is learning over the last 7 days.</p>
        </div>
        <TrendBadge value={data[data.length - 1]?.delta ?? 0} />
      </div>
      <div className="space-y-3">
        {data.map((point) => {
          const width = `${(point.mqi / maxScore) * 100}%`;
          return (
            <div
              key={point.label}
              className="rounded-xl border border-indigo-50 bg-indigo-50/60 p-4 dark:border-indigo-900/40 dark:bg-indigo-900/20"
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-indigo-600">{point.window}</span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{point.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <TrendBadge value={point.delta} />
                  <span className="text-base font-semibold text-indigo-700 dark:text-indigo-200">{point.mqi.toFixed(1)}</span>
                </div>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/70 dark:bg-indigo-950">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400" style={{ width }} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-indigo-700 shadow-sm dark:bg-indigo-950/80 dark:text-indigo-100">
                  {point.samples} samples
                </span>
                {point.signals.map((signal) => (
                  <span
                    key={signal}
                    className="rounded-full bg-white px-2 py-0.5 text-[11px] text-zinc-700 shadow-sm dark:bg-indigo-950/80 dark:text-zinc-200"
                  >
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PresetPerformance({
  data,
}: {
  data: { preset: string; mode: string; score: number; delta: number; sampleSize: number }[];
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            <BeakerIcon className="h-4 w-4" aria-hidden />
            Presets
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Preset performance comparison</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Live vs experimental presets ranked by MQI.</p>
        </div>
        <span className="text-xs font-medium text-indigo-700 dark:text-indigo-200">Transparent by design</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {data.map((entry) => (
          <div
            key={entry.preset}
            className="flex flex-col gap-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60"
          >
            <div className="flex items-center justify-between text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              <span>{entry.preset}</span>
              <TrendBadge value={entry.delta} />
            </div>
            <div>
              <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-200">{entry.score.toFixed(1)}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Mode: {entry.mode}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{entry.sampleSize} recent runs</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoleFamilyInsights({
  data,
}: {
  data: { roleFamily: string; lift: string; focus: string; blockers: string; status: string }[];
}) {
  const statusTone: Record<string, string> = {
    improving: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100",
    watch: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-100",
    paused: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-100",
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            <ChartBarIcon className="h-4 w-4" aria-hidden />
            Role families
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Role family insights</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Where MQI lift is coming from and what is blocked.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {data.map((entry) => (
          <div
            key={entry.roleFamily}
            className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60"
          >
            <div className="flex items-center justify-between text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              <div className="flex items-center gap-3">
                <span>{entry.roleFamily}</span>
                <span className="text-emerald-600 dark:text-emerald-200">{entry.lift}</span>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone[entry.status]}`}>{entry.status}</span>
            </div>
            <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
              <p className="font-semibold">Focus</p>
              <p className="text-zinc-600 dark:text-zinc-400">{entry.focus}</p>
            </div>
            <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
              <p className="font-semibold">Blockers</p>
              <p className="text-zinc-600 dark:text-zinc-400">{entry.blockers}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OptimizationBacklog({
  data,
}: {
  data: { title: string; owner: string; status: string; impact: string; eta: string; notes?: string }[];
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            <ClipboardDocumentListIcon className="h-4 w-4" aria-hidden />
            Optimization
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Optimization suggestions backlog</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">What is queued, in flight, or paused.</p>
        </div>
      </div>
      <div className="mt-4 divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
        {data.map((item) => (
          <div key={item.title} className="flex flex-col gap-1 py-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{item.title}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Owner: {item.owner}</p>
              {item.notes ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.notes}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-100">{item.status}</span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100">{item.impact} impact</span>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">ETA: {item.eta}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LearningPauses({ data }: { data: { label: string; active: boolean; reason: string; since: string; impact: string }[] }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-200">
            <PauseCircleIcon className="h-5 w-5" aria-hidden />
            Learning pauses
          </div>
          <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-50">Fire Drill & Pilot indicators</h3>
          <p className="text-sm text-amber-900/80 dark:text-amber-100/80">Know when learning is paused and why.</p>
        </div>
        <ShieldCheckIcon className="h-5 w-5 text-amber-700 dark:text-amber-200" aria-hidden />
      </div>
      <div className="mt-4 space-y-3">
        {data.map((entry) => (
          <div
            key={entry.label}
            className={`rounded-xl border p-4 ${
              entry.active
                ? "border-amber-300 bg-white/60 dark:border-amber-900/50 dark:bg-amber-950/60"
                : "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-50">
                <span>{entry.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    entry.active
                      ? "bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100"
                      : "bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100"
                  }`}
                >
                  {entry.active ? "Paused" : "Running"}
                </span>
              </div>
              <span className="text-xs font-medium text-amber-800 dark:text-amber-100">{entry.since}</span>
            </div>
            <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">{entry.reason}</p>
            <p className="text-xs text-amber-800/80 dark:text-amber-100/70">Impact: {entry.impact}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function EteInsightsPage() {
  const user = await getCurrentUser();
  const tenantId = await getCurrentTenantId();
  const userTenant = (user?.tenantId ?? DEFAULT_TENANT_ID).trim();
  const isAuthorized = user && isAdminRole(user.role) && userTenant === tenantId.trim();

  if (!isAuthorized) {
    return <AccessDenied />;
  }

  const metrics = await getEteInsightsMetrics(tenantId);

  return (
    <ETEClientLayout>
      <main className="min-h-screen bg-zinc-50 px-6 py-10 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin</p>
              <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">ETE Insights</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Tenant <span className="font-semibold text-zinc-900 dark:text-zinc-100">{tenantId}</span> overview of
                pipeline activity and quality signals.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-indigo-400"
            >
              Back to home
            </Link>
          </header>

          <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Match runs"
              value={metrics.pipelineRuns.reduce((sum, bucket) => sum + bucket.count, 0)}
              description="Total pipeline executions in the last 7 days"
              icon={ClockIcon}
            />
            <StatCard
              label="Avg matches/job"
              value={metrics.averageMatchesPerJob.toFixed(1)}
              description="Match results returned per job req"
              icon={ArrowTrendingUpIcon}
            />
            <StatCard
              label="Top error rate"
              value={metrics.errorRateByAgent[0] ? `${(metrics.errorRateByAgent[0].errorRate * 100).toFixed(1)}%` : "0.0%"}
              description={metrics.errorRateByAgent[0] ? `Worst offender: ${metrics.errorRateByAgent[0].agentName}` : "No failures"}
              icon={ExclamationTriangleIcon}
            />
            <StatCard
              label="Est. time-to-fill"
              value={`${metrics.estimatedTimeToFillDays.toFixed(1)} days`}
              description="Estimate based on shortlist velocity"
              icon={ClockIcon}
            />
            <StatCard
              label="Skill scarcity index"
              value={`${metrics.skillScarcityIndex.toFixed(1)}/100`}
              description="Estimate of candidate supply"
              icon={SignalIcon}
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PipelineRunChart data={metrics.pipelineRuns} />
            </div>
            <ModeBreakdownList data={metrics.matchRunsByMode} />
          </div>

          <BehaviorInsightsCard insights={metrics.recruiterBehavior} />

          <div className="grid gap-6 lg:grid-cols-3">
            <EstimateTrendChart
              title="Estimated time-to-fill (est.)"
              description="Average forecast for jobs created each day"
              unit="days"
              data={metrics.timeToFillTrend}
            />
            <EstimateTrendChart
              title="Skill scarcity (est.)"
              description="Higher numbers mean tighter supply"
              unit="index"
              data={metrics.skillScarcityTrend}
            />
            <ShortlistDistribution data={metrics.shortlistDistribution} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ErrorRateTable data={metrics.errorRateByAgent} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <MatchQualityTimeline data={metrics.matchQualityHistory} />
            </div>
            <LearningPauses data={metrics.learningPauses} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <PresetPerformance data={metrics.presetPerformance} />
            <RoleFamilyInsights data={metrics.roleFamilyInsights} />
          </div>

          <OptimizationBacklog data={metrics.optimizationBacklog} />
        </div>
      </main>
    </ETEClientLayout>
  );
}
