import { ArrowTopRightOnSquareIcon, BoltIcon, ChartBarIcon, SparklesIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import { getClientRelativeBenchmarks } from "@/lib/benchmarks/clientRelativeBenchmarks";
import { canAccessExecIntelligence } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { ExecAccessDenied } from "../ExecAccessDenied";
import { RiskAlertsPanel } from "./RiskAlertsPanel";
import { BackToConsoleButton } from "@/components/BackToConsoleButton";

const marketSignals = [
  {
    title: "Product design talent tightening",
    change: "-12% available candidates QoQ across SF and NYC",
    highlight: "Fewer senior ICs on market; relocations slowing.",
  },
  {
    title: "Data roles stabilizing",
    change: "+6% supply in AI/ML pipelines vs last month",
    highlight: "More mid-level applicants responding within 48 hours.",
  },
  {
    title: "Enterprise GTM demand up",
    change: "+9% recruiter-sourced opps for AM/CSM",
    highlight: "Signals from L2 forecasts point to Q4 territory expansions.",
  },
];

const benchmarkHighlights = [
  {
    metric: "Time-to-offer",
    value: "28 days",
    delta: "4 days faster than last quarter",
  },
  {
    metric: "Screen-to-onsite",
    value: "34% conversion",
    delta: "Up 6 pts with refreshed rubrics",
  },
  {
    metric: "Offer acceptance",
    value: "78%",
    delta: "Steady; watch for design comp pressure",
  },
];

const copilotPrompts = [
  {
    title: "Where are we stuck?",
    description: "Summarize the searches most likely to slip and why, with mitigation options.",
  },
  {
    title: "Who to nudge today?",
    description: "List candidates or hiring managers that need responses to keep this week on track.",
  },
  {
    title: "How do we compare?",
    description: "Benchmark my open roles against peers for time-to-offer and acceptance risk.",
  },
];

export default async function ExecEteOverviewPage() {
  const user = await getCurrentUser();
  const allowed = user && canAccessExecIntelligence(user, user.tenantId);

 if (!user || !allowed || !user.tenantId) {
    return <ExecAccessDenied />;
  }

  const benchmarking = await getClientRelativeBenchmarks({ tenantId: user.tenantId });

  return (
    <ETEClientLayout maxWidthClassName="max-w-6xl" contentClassName="space-y-10">
      <div className="flex justify-end">
        <BackToConsoleButton />
      </div>
      <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/60 dark:via-zinc-950 dark:to-emerald-950/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Exec Intelligence Portal</p>
            <h1 className="text-3xl font-semibold leading-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">ETE overview</h1>
            <p className="max-w-3xl text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
              Fast scan for market shifts, hiring risks, and benchmarks—built for executives who need the state of recruiting in minutes, not hours.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/ete/insights"
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <SparklesIcon className="h-5 w-5" aria-hidden />
              View insights
              <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/exec/ete/decision-quality"
              className="inline-flex items-center gap-2 rounded-full border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40"
            >
              <ChartBarIcon className="h-5 w-5" aria-hidden />
              Decision quality
            </Link>
            <Link
              href="/ete/recruiter-copilot"
              className="inline-flex items-center gap-2 rounded-full border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40"
            >
              Ask Copilot
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4 rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">What's changing in the talent market</p>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Signals to watch this week</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">Latest supply and demand movements drawn from benchmarks and recent searches.</p>
            </div>
            <Link
              href="/admin/ete/insights"
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:text-indigo-800 dark:text-indigo-200 dark:hover:text-indigo-100"
            >
              Go to Insights
              <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {marketSignals.map((signal) => (
              <div
                key={signal.title}
                className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-200 dark:ring-indigo-800/60">
                  <BoltIcon className="h-4 w-4" aria-hidden />
                  Market shift
                </div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{signal.title}</h3>
                <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-200">{signal.change}</p>
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{signal.highlight}</p>
              </div>
            ))}
          </div>
        </div>

        <RiskAlertsPanel />
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4 rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Benchmarks this quarter</p>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Executive rollup</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">Comparisons to last quarter so you can gut-check pacing and acceptance.</p>
            </div>
            <Link
              href="/admin/ete/insights"
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:text-indigo-800 dark:text-indigo-200 dark:hover:text-indigo-100"
            >
              View benchmarks
              <ChartBarIcon className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {benchmarkHighlights.map((item) => (
              <div
                key={item.metric}
                className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{item.metric}</p>
                <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{item.value}</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-200">{item.delta}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4 text-sm text-indigo-900 shadow-sm dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-100">
            <p className="font-semibold">How to use</p>
            <p className="mt-1 leading-relaxed">Use these benchmarks to check which searches are outside the expected window before your next exec review.</p>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4 rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Ask Copilot</p>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Executive prompts</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">Jump straight to the copilot with exec-ready questions.</p>
            </div>
            <SparklesIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-300" aria-hidden />
          </div>
          <div className="space-y-3">
            {copilotPrompts.map((prompt) => (
              <div key={prompt.title} className="space-y-1 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{prompt.title}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">{prompt.description}</p>
              </div>
            ))}
          </div>
          <Link
            href="/ete/recruiter-copilot"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Open copilot
            <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">How do we compare?</p>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Client-relative benchmarking</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Opt-in tenants can benchmark their signals against anonymized industry, regional, and size cohorts. Results stay advisory only—no peer identities or raw records are ever exposed.
            </p>
          </div>
          <div className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-200 dark:ring-indigo-800/60">
            Rolling {benchmarking.windowDays}-day medians
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {benchmarking.optedIn ? (
            benchmarking.comparisons.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-zinc-800 dark:text-zinc-100">
                  <thead className="text-xs uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
                    <tr>
                      <th className="px-3 py-2">Metric</th>
                      <th className="px-3 py-2">Client</th>
                      <th className="px-3 py-2">Benchmark</th>
                      <th className="px-3 py-2">Delta</th>
                      <th className="px-3 py-2">Interpretation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {benchmarking.comparisons.map((entry) => (
                      <tr key={`${entry.metric}-${entry.basis}`} className="align-top">
                        <td className="px-3 py-3 font-semibold text-zinc-900 dark:text-zinc-50">{entry.metric}</td>
                        <td className="px-3 py-3">{entry.clientValue}</td>
                        <td className="px-3 py-3">{entry.benchmarkValue}</td>
                        <td className={`px-3 py-3 font-semibold ${entry.delta >= 0 ? "text-emerald-700 dark:text-emerald-200" : "text-amber-700 dark:text-amber-200"}`}>
                          {entry.delta >= 0 ? "+" : ""}
                          {entry.delta}
                        </td>
                        <td className="px-3 py-3 text-sm text-zinc-700 dark:text-zinc-200">{entry.interpretation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 p-4 text-sm text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-100">
                <p className="font-semibold">We need more opted-in signals to generate peer comparisons.</p>
                <p>Keep contributing anonymized learning to unlock industry, region, and size-cohort medians.</p>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-2 rounded-xl border border-dashed border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="font-semibold">Opt in to anonymized benchmarking</p>
              <p>
                Toggle network learning in guardrails to compare against peers without sharing any personally identifiable information. Only k-anonymized aggregates are used for medians.
              </p>
              <Link
                href="/admin/ete/guardrails"
                className="inline-flex w-fit items-center gap-2 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                Manage guardrails
                <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          )}
        </div>

        <ul className="mt-4 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
          {benchmarking.notes.map((note) => (
            <li key={note} className="flex items-start gap-2">
              <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden />
              {note}
            </li>
          ))}
        </ul>
      </section>
    </ETEClientLayout>
  );
}
