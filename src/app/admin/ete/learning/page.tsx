import {
  ArrowTrendingUpIcon,
  BeakerIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";
import { getEteInsightsMetrics } from "@/lib/metrics/eteInsights";
import { LearningControls } from "@/components/admin/learning/LearningControls";

export const dynamic = "force-dynamic";

function AccessDenied() {
  return (
    <ETEClientLayout>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need to be a tenant admin for this workspace to manage ETE learning.
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

function LearningStatusBanner({
  status,
  reason,
  since,
}: {
  status: "active" | "paused";
  reason: string;
  since: string;
}) {
  const tone =
    status === "paused"
      ? {
          border: "border-amber-200 dark:border-amber-900/50",
          bg: "bg-amber-50 dark:bg-amber-950/40",
          icon: <PauseCircleIcon className="h-6 w-6 text-amber-600 dark:text-amber-200" aria-hidden />,
        }
      : {
          border: "border-emerald-200 dark:border-emerald-900/50",
          bg: "bg-emerald-50 dark:bg-emerald-950/40",
          icon: <PlayCircleIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-200" aria-hidden />,
        };

  return (
    <div className={`rounded-2xl border ${tone.border} ${tone.bg} p-6 shadow-sm transition`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {tone.icon}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-300">Learning status</p>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  status === "paused"
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-50"
                    : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-50"
                }`}
              >
                {status === "paused" ? "Paused" : "Active"}
              </span>
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{reason}</span>
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-zinc-600 dark:text-zinc-300">
          <p>Since: {since}</p>
          <p className="font-medium">Soft toggle only — no auto-application of changes.</p>
        </div>
      </div>
    </div>
  );
}

function MatchQualityTrend({
  data,
}: {
  data: Awaited<ReturnType<typeof getEteInsightsMetrics>>["matchQualityHistory"];
}) {
  const maxScore = Math.max(...data.map((entry) => entry.mqi), 1);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">MQI</p>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Match quality over time</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Rolling windows of the Match Quality Index.</p>
        </div>
        <ArrowTrendingUpIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-300" aria-hidden />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {data.map((entry) => {
          const heightPercent = `${(entry.mqi / maxScore) * 100}%`;
          return (
            <div
              key={entry.label}
              className="flex items-center gap-4 rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <div className="flex h-20 w-14 items-end rounded-lg bg-white dark:bg-zinc-950">
                <div
                  className="w-full rounded-lg bg-indigo-500"
                  style={{ height: heightPercent }}
                  aria-label={`${entry.label}: MQI ${entry.mqi.toFixed(2)}`}
                />
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{entry.window}</p>
                <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{entry.label}</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-200">MQI {entry.mqi.toFixed(2)}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Δ {entry.delta >= 0 ? "+" : ""}{entry.delta.toFixed(2)} • {entry.samples} signals</p>
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
  data: Awaited<ReturnType<typeof getEteInsightsMetrics>>["roleFamilyInsights"];
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Presets</p>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Preset performance by role family</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Lift, focus areas, and blockers for each family.</p>
        </div>
        <BeakerIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-300" aria-hidden />
      </div>

      <div className="mt-4 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
        {data.map((entry) => (
          <div key={entry.roleFamily} className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{entry.roleFamily}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Focus: {entry.focus}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Blockers: {entry.blockers}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-100">{entry.lift} lift</span>
              <span
                className={`rounded-full px-3 py-1 ${
                  entry.status === "improving"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100"
                    : entry.status === "watch"
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-100"
                      : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-100"
                }`}
              >
                {entry.status === "improving" ? "Improving" : entry.status === "watch" ? "Watch" : "Paused"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OptimizationRecommendations({
  data,
}: {
  data: Awaited<ReturnType<typeof getEteInsightsMetrics>>["optimizationBacklog"];
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Optimization</p>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Optimization recommendations</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Read-only backlog to inform manual decisions.</p>
        </div>
        <SparklesIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-300" aria-hidden />
      </div>

      <div className="mt-4 space-y-3 text-sm">
        {data.map((item) => (
          <div key={item.title} className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{item.title}</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">Owner: {item.owner}</p>
                {item.notes ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.notes}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{item.status}</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100">{item.impact} impact</span>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-100">ETA {item.eta}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-amber-700 dark:text-amber-200">
        Recommendations are monitored only — no changes are applied automatically.
      </p>
    </div>
  );
}

export default async function EteLearningPage() {
  const user = await getCurrentUser();
  const tenantId = await getCurrentTenantId();
  const userTenant = (user?.tenantId ?? DEFAULT_TENANT_ID).trim();
  const isAuthorized = user && isAdminRole(user.role) && userTenant === tenantId.trim();

  if (!isAuthorized) {
    return <AccessDenied />;
  }

  const metrics = await getEteInsightsMetrics(tenantId);
  const pausedState = metrics.learningPauses.find((pause) => pause.active);

  return (
    <ETEClientLayout>
      <main className="min-h-screen bg-zinc-50 px-6 py-10 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin</p>
              <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">ETE Learning Dashboard</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Tenant <span className="font-semibold text-zinc-900 dark:text-zinc-100">{tenantId}</span> learning status and guardrails.
              </p>
            </div>

            <Link
              href="/admin/ete/insights"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-indigo-400"
            >
              <ArrowTrendingUpIcon className="h-4 w-4" aria-hidden /> View insights
            </Link>
          </header>

          <LearningStatusBanner
            status={pausedState ? "paused" : "active"}
            reason={pausedState ? pausedState.reason : "Learning is active and capturing signals."}
            since={pausedState ? pausedState.since : "Now"}
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <MatchQualityTrend data={metrics.matchQualityHistory} />
            </div>
            <div className="flex flex-col gap-4">
              <LearningControls initialPaused={Boolean(pausedState)} pausedReason={pausedState?.reason ?? "Capturing live feedback"} />
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/40">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-100">
                  <CheckCircleIcon className="h-5 w-5" aria-hidden />
                  <p className="font-semibold">Acceptance criteria</p>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-emerald-900 dark:text-emerald-50">
                  <li>Admin can see how ETE is learning.</li>
                  <li>Learning can be paused instantly.</li>
                  <li>No auto-application of changes.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <PresetPerformance data={metrics.roleFamilyInsights} />
            <OptimizationRecommendations data={metrics.optimizationBacklog} />
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/40">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-700 dark:text-amber-200" aria-hidden />
              <div className="space-y-1 text-sm text-amber-900 dark:text-amber-50">
                <p className="font-semibold">Learning controls are soft toggles.</p>
                <p>
                  Use these controls to pause or resume learning immediately. No automated roll-outs occur; apply changes manually after review.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </ETEClientLayout>
  );
}
