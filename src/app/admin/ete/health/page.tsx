import {
  BoltIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  SignalIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { isAdminOrDataAccessRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const statusStyles = {
  healthy: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-50",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-50",
  critical: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-50",
};

type JobHealth = {
  name: string;
  lastSuccess: string;
  sla: string;
  failureCount: number;
  cacheHitRate: number;
  avgDuration: string;
  status: keyof typeof statusStyles;
  state: "Running" | "Idle" | "Cooling down";
};

const jobHealth: JobHealth[] = [
  {
    name: "Candidate profile ingest",
    lastSuccess: "14:22 UTC",
    sla: "< 15m",
    failureCount: 0,
    cacheHitRate: 0.94,
    avgDuration: "7m 12s",
    status: "healthy",
    state: "Running",
  },
  {
    name: "Job catalog refresh",
    lastSuccess: "14:15 UTC",
    sla: "< 30m",
    failureCount: 1,
    cacheHitRate: 0.88,
    avgDuration: "12m 41s",
    status: "warning",
    state: "Cooling down",
  },
  {
    name: "Matching engine SLA poller",
    lastSuccess: "14:05 UTC",
    sla: "< 10m",
    failureCount: 0,
    cacheHitRate: 0.97,
    avgDuration: "4m 55s",
    status: "healthy",
    state: "Running",
  },
  {
    name: "Quality signals aggregator",
    lastSuccess: "13:58 UTC",
    sla: "< 20m",
    failureCount: 3,
    cacheHitRate: 0.76,
    avgDuration: "16m 03s",
    status: "critical",
    state: "Idle",
  },
];

const slaAlerts = [
  {
    label: "Early warning",
    detail: "Quality signals aggregator is breaching p95 execution time for the last 3 runs.",
    tone: "critical" as const,
  },
  {
    label: "Stability",
    detail: "Job catalog refresh retried once but stayed within SLA; keep under watch.",
    tone: "warning" as const,
  },
  {
    label: "Coverage",
    detail: "No missed runs in the past 12 hours across monitored jobs.",
    tone: "healthy" as const,
  },
];

function AccessDenied() {
  return (
    <ETEClientLayout>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need to be a tenant admin for this workspace to view the Intelligence health dashboard.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium text-amber-900 underline">
              Back to Console
            </Link>
          </div>
        </div>
      </main>
    </ETEClientLayout>
  );
}

export default async function EteHealthPage() {
  const user = await getCurrentUser();
  const tenantId = (await getCurrentTenantId()) ?? user?.tenantId ?? DEFAULT_TENANT_ID;

  if (!user || !isAdminOrDataAccessRole(user.role) || (user.tenantId ?? DEFAULT_TENANT_ID) !== tenantId) {
    return <AccessDenied />;
  }

  return (
    <ETEClientLayout showFireDrillBanner={false}>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-4 rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm dark:border-indigo-900/60 dark:from-indigo-950/50 dark:via-zinc-950 dark:to-emerald-950/40">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">Ops dashboard</p>
            <h1 className="text-3xl font-semibold text-zinc-900 sm:text-4xl dark:text-zinc-50">Intelligence health &amp; SLA</h1>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Early warnings for Intelligence runtime jobs so ops and engineering can fix issues before users notice.
            </p>
          </div>

          <div className="grid gap-3 text-sm text-zinc-700 sm:grid-cols-3 dark:text-zinc-200">
            <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-3 shadow-sm ring-1 ring-indigo-100 backdrop-blur dark:bg-zinc-900/60 dark:ring-indigo-900/50">
              <ShieldCheckIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-300" aria-hidden />
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">SLA guardrails</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">No manual log digging required.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-3 shadow-sm ring-1 ring-indigo-100 backdrop-blur dark:bg-zinc-900/60 dark:ring-indigo-900/50">
              <BoltIcon className="h-5 w-5 text-amber-600 dark:text-amber-300" aria-hidden />
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">Autofix signals</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">Catch regressions before a user report.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-3 shadow-sm ring-1 ring-indigo-100 backdrop-blur dark:bg-zinc-900/60 dark:ring-indigo-900/50">
              <ClockIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-300" aria-hidden />
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">Freshness</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">All jobs checked in the last 20 minutes.</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Last successful runs</p>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Job health summary</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Recency, failure counts, cache health, and runtime state.</p>
              </div>
              <SignalIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-300" aria-hidden />
            </div>

            <div className="mt-5 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              {jobHealth.map((job) => (
                <div key={job.name} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{job.name}</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">SLA: {job.sla}</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">Last successful run: {job.lastSuccess}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[job.status]}`}>
                      {job.status === "healthy" ? "Healthy" : job.status === "warning" ? "Warning" : "Critical"}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
                      State: {job.state}
                    </span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
                      Failures (24h): {job.failureCount}
                    </span>
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-100">
                      Cache hit: {(job.cacheHitRate * 100).toFixed(0)}%
                    </span>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100">
                      Avg exec: {job.avgDuration}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">SLA status</p>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Early warnings</h3>
                </div>
                <ClockIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-300" aria-hidden />
              </div>

              <div className="mt-4 space-y-3">
                {slaAlerts.map((alert) => (
                  <div
                    key={alert.label}
                    className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-sm shadow-sm ${
                      alert.tone === "critical"
                        ? "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/40"
                        : alert.tone === "warning"
                          ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/40"
                          : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/40"
                    }`}
                  >
                    {alert.tone === "critical" ? (
                      <XCircleIcon className="h-5 w-5 text-rose-600 dark:text-rose-200" aria-hidden />
                    ) : alert.tone === "warning" ? (
                      <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-200" aria-hidden />
                    ) : (
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-200" aria-hidden />
                    )}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">{alert.label}</p>
                      <p className="text-sm text-zinc-800 dark:text-zinc-100">{alert.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">SLA guardrail</p>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Ops in front of users</h3>
                </div>
                <ShieldCheckIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-300" aria-hidden />
              </div>
              <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                We surface failure counts, cache behavior, and average execution time for every Intelligence job so operations can
                intervene before user-facing SLAs degrade. All panels avoid manual log digging and highlight the state of each
                worker.
              </p>
            </div>
          </div>
        </section>
      </div>
    </ETEClientLayout>
  );
}
