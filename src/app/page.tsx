import Link from "next/link";

import { FEATURE_FLAGS, isFeatureEnabled } from "@/lib/featureFlags";
import { getSystemStatus } from "@/lib/systemStatus";
import { SystemStatus } from "@/components/SystemStatus";
import { getHomeCardMetrics, type HomeCardMetrics } from "@/lib/metrics/home";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type HomeLink = {
  label: string;
  href: string;
  requires?: Array<(typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS]>;
  description?: string;
  stats?: { label: string; value: string }[];
};

function formatCount(value: number | null) {
  if (value == null) return "Unknown";
  return value.toLocaleString();
}

function formatAgentRuns(value: number | null) {
  if (value == null) return "Unknown";
  if (value === 0) return "No runs recorded";
  return `${value.toLocaleString()} runs`;
}

function buildLinks(metrics: HomeCardMetrics): HomeLink[] {
  return [
    {
      label: "Upload and parse resume",
      href: "/rina-test",
      requires: [FEATURE_FLAGS.AGENTS],
      description: "RINA — Resume ingestion agent",
    },
    {
      label: "Create job intake",
      href: "/rua-test",
      requires: [FEATURE_FLAGS.AGENTS],
      description: "RUA — Job intake agent",
    },
    {
      label: "Execution history",
      href: "/agents/runs",
      requires: [FEATURE_FLAGS.AGENTS],
      description: "Latest agent runs",
      stats: [{ label: "Agent runs in last 7 days", value: formatAgentRuns(metrics.agentRunsLast7d) }],
    },
    {
      label: "Job library",
      href: "/jobs",
      requires: [FEATURE_FLAGS.SCORING],
      description: "Roles with scoring",
      stats: [
        { label: "Job library", value: formatCount(metrics.totalJobs) },
        { label: "Roles with test content", value: formatCount(metrics.testContentRoles) },
      ],
    },
    {
      label: "Candidate pool",
      href: "/candidates",
      requires: [FEATURE_FLAGS.SCORING],
      description: "Candidate library",
      stats: [{ label: "Candidate pool", value: formatCount(metrics.totalCandidates) }],
    },
    { label: "System controls", href: "/admin/feature-flags", description: "Admin feature toggles" },
  ];
}

export default async function Home() {
  const [uiEnabled, agentsEnabled, scoringEnabled, systemStatus, metrics] = await Promise.all([
    isFeatureEnabled(FEATURE_FLAGS.UI_BLOCKS),
    isFeatureEnabled(FEATURE_FLAGS.AGENTS),
    isFeatureEnabled(FEATURE_FLAGS.SCORING),
    getSystemStatus(),
    getHomeCardMetrics(),
  ]);

  const featureMap: Record<string, boolean> = {
    [FEATURE_FLAGS.UI_BLOCKS]: uiEnabled,
    [FEATURE_FLAGS.AGENTS]: agentsEnabled,
    [FEATURE_FLAGS.SCORING]: scoringEnabled,
  };

  const links = buildLinks(metrics);

  if (!uiEnabled) {
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-900">
        <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-16 sm:px-12">
          <header className="mt-8 flex flex-col gap-3 sm:mt-12">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600">EAT</p>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">EAT – Talent System (MVP)</h1>
            <p className="max-w-2xl text-lg text-zinc-600">
              UI blocks are turned off. Enable the UI Blocks flag to restore navigation and workflows.
            </p>
            <Link href="/admin/feature-flags" className="text-sm font-semibold text-indigo-700 underline">
              Go to Feature Flags
            </Link>
          </header>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-12 px-6 py-16 sm:px-12">
        <header className="mt-8 flex flex-col gap-3 sm:mt-12">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">EAT</p>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">EAT – Talent System (MVP)</h1>
          <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Quick links to the core workflows for the EDGE (Emerging, Disruptive & Growth Enabling) Agent Toolkit.
          </p>
        </header>

        <SystemStatus initialStatus={systemStatus} />

        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => {
            const isActive = (link.requires ?? []).every((flag) => featureMap[flag]);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition dark:border-zinc-800 dark:bg-zinc-900 ${
                  isActive ? "hover:-translate-y-1 hover:shadow-lg" : "opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">{link.label}</h2>
                  <span
                    className={`rounded-full border px-3 py-1 text-sm transition ${
                      isActive
                        ? "border-zinc-200 text-zinc-600 group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-700 dark:border-zinc-700 dark:text-zinc-300 dark:group-hover:border-indigo-600/60 dark:group-hover:bg-indigo-600/10 dark:group-hover:text-indigo-300"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {isActive ? "Open" : "Disabled"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  {link.description ?? `${link.label} workflow`}
                </p>
                {link.stats ? (
                  <dl className="mt-4 space-y-2">
                    {link.stats.map((stat) => (
                      <div key={stat.label} className="flex items-baseline justify-between">
                        <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          {stat.label}
                        </dt>
                        <dd className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{stat.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {link.requires && link.requires.length > 0 && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Requires: {link.requires.map((flag) => flag.replace("-", " ")).join(", ")}
                  </p>
                )}
              </Link>
            );
          })}
        </section>
      </main>
    </div>
  );
}
