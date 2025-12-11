import Link from "next/link";

import { FEATURE_FLAGS, isFeatureEnabled } from "@/lib/featureFlags";
import {
  getSystemExecutionState,
  getSystemStatus,
  type SubsystemKey,
  type SubsystemState,
  type SystemStatusMap,
} from "@/lib/systemStatus";
import { SystemHealthPanel } from "@/components/SystemHealthPanel";
import { EATClientLayout } from "@/components/EATClientLayout";
import { getHomeCardMetrics, type HomeCardMetrics } from "@/lib/metrics/home";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type HomeLink = {
  label: string;
  cta: string;
  href: string;
  description?: string;
  stats?: { label: string; value: string }[];
  dependency?: {
    subsystem: SubsystemKey;
    allowWhenDataPresent?: boolean;
    dataCount?: number | null;
    label?: string;
    flow?: {
      source: string;
      target: string;
    };
  };
};

function formatJobCount(value: number | null) {
  if (value == null || value === 0) return "No jobs ingested";
  return value.toLocaleString();
}

function formatTestContentCount(value: number | null) {
  if (value == null || value === 0) return "Not configured";
  return value.toLocaleString();
}

function formatCandidateCount(value: number | null) {
  if (value == null || value === 0) return "Awaiting resumes";
  return value.toLocaleString();
}

function formatAgentRuns(value: number | null) {
  if (value == null || value === 0) return "No agent runs";
  return `${value.toLocaleString()} runs`;
}

const dependencyLabels: Record<SubsystemKey, string> = {
  agents: "Agents",
  scoring: "Scoring Engine",
  database: "Database",
  tenantConfig: "Tenant Config",
};

type CardState = "idle" | "running" | "degraded" | "disabled";

const cardStateStyles: Record<CardState, { rail: string; chip: string }> = {
  idle: {
    rail: "bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-500",
    chip: "border-blue-200/80 bg-blue-50 text-blue-800",
  },
  running: {
    rail: "bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400",
    chip: "border-emerald-200/80 bg-emerald-50 text-emerald-800",
  },
  degraded: {
    rail: "bg-gradient-to-r from-red-400 via-rose-500 to-red-500",
    chip: "border-red-200/80 bg-red-50 text-red-800",
  },
  disabled: {
    rail: "bg-gradient-to-r from-zinc-300 via-zinc-400 to-zinc-300",
    chip: "border-zinc-200/80 bg-zinc-50 text-zinc-700",
  },
};

const dependencyStatusStyles: Record<SubsystemState, string> = {
  healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  error: "bg-red-50 text-red-700 border-red-200",
  unknown: "bg-zinc-50 text-zinc-600 border-zinc-200",
};

const dependencyDotStyles: Record<SubsystemState, string> = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  unknown: "bg-zinc-400",
};

<<<<<<< ours
<<<<<<< ours
const dependencyStatusTextStyles: Record<SubsystemState, string> = {
  healthy: "text-emerald-700 dark:text-emerald-200",
  warning: "text-amber-700 dark:text-amber-200",
  error: "text-red-700 dark:text-red-200",
  unknown: "text-zinc-600 dark:text-zinc-400",
};

const stateRailStyles: Record<BadgeState, string> = {
  enabled: "from-indigo-400 via-blue-400 to-emerald-400 opacity-70",
  healthy: "from-emerald-400 via-emerald-300 to-green-400 opacity-80",
  warning: "from-amber-400 via-orange-300 to-amber-500 opacity-80",
  error: "from-red-500 via-rose-400 to-red-600 opacity-80",
  unknown: "from-zinc-400 via-slate-400 to-zinc-500 opacity-60",
=======
const heartbeatStyles: Record<
  SystemExecutionState["state"],
  { badge: string; dot: string; label: "LIVE" | "IDLE" | "DEGRADED" }
> = {
  operational: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    label: "LIVE",
  },
  idle: {
    badge: "border-zinc-200 bg-white text-zinc-700",
    dot: "bg-zinc-400",
    label: "IDLE",
  },
  degraded: {
    badge: "border-rose-200 bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
    label: "DEGRADED",
  },
>>>>>>> theirs
};

function formatStatusText(status: BadgeState) {
=======
function getCardState(
  dependencyState: ReturnType<typeof getDependencyState>,
  executionState: SystemExecutionState,
): CardState {
  if (!dependencyState.isActive) {
    return "disabled";
  }

  if (["warning", "error", "unknown"].includes(dependencyState.status)) {
    return "degraded";
  }

  if (executionState.state === "operational") {
    return "running";
  }

  return "idle";
}

function formatStatusText(status: CardState) {
>>>>>>> theirs
  switch (status) {
    case "running":
      return "Running";
    case "degraded":
      return "Degraded";
    case "disabled":
      return "Disabled";
    case "idle":
    default:
      return "Idle";
  }
}

function buildLinks(metrics: HomeCardMetrics): HomeLink[] {
  return [
    {
      label: "Upload resumes",
      cta: "Ingest resumes",
      href: "/rina-test",
      description: "RINA — Resume ingestion agent",
      dependency: { subsystem: "agents" },
    },
    {
      label: "Create intake",
      cta: "Launch intake",
      href: "/rua-test",
      description: "RUA — Job intake agent",
      dependency: { subsystem: "agents" },
    },
    {
      label: "Execution history",
      cta: "Trace executions",
      href: "/agents/runs",
      description: "Latest agent runs",
      stats: [{ label: "Agent runs in last 7 days", value: formatAgentRuns(metrics.agentRunsLast7d) }],
      dependency: {
        subsystem: "agents",
        flow: { source: "Execution History", target: "Agents" },
      },
    },
    {
      label: "Job library",
      cta: "View roles",
      href: "/jobs",
      description: "Roles with scoring",
      stats: [
        { label: "Job library", value: formatJobCount(metrics.totalJobs) },
        { label: "Roles with test content", value: formatTestContentCount(metrics.testContentRoles) },
      ],
      dependency: {
        subsystem: "agents",
        allowWhenDataPresent: true,
        dataCount: metrics.totalJobs,
        label: "Intake Agent",
        flow: { source: "Job Library", target: "Intake Agent" },
      },
    },
    {
      label: "Candidate pool",
      cta: "Browse",
      href: "/candidates",
      description: "Candidate library",
      stats: [{ label: "Candidate pool", value: formatCandidateCount(metrics.totalCandidates) }],
      dependency: {
        subsystem: "scoring",
        allowWhenDataPresent: true,
        dataCount: metrics.totalCandidates,
        flow: { source: "Candidate Pool", target: "Scoring Engine" },
      },
    },
    {
      label: "Feature flags",
      cta: "Configure",
      href: "/admin/feature-flags",
      description: "Admin feature toggles",
      dependency: { subsystem: "tenantConfig" },
    },
  ];
}

function getDependencyState(link: HomeLink, statusMap: SystemStatusMap) {
  if (!link.dependency) {
    return { status: "enabled", isActive: true } as const;
  }

  const dependency = statusMap[link.dependency.subsystem] ?? { status: "unknown" };
  const dependencyStatus = dependency.status ?? "unknown";
  const dataAvailable = (link.dependency.dataCount ?? 0) > 0;
  const canOpenWithData = link.dependency.allowWhenDataPresent && dataAvailable;

  if (dependency.status === "healthy") {
    return {
      status: "enabled",
      isActive: true,
      dependencyStatus,
      dependencyLabel: link.dependency.label ?? dependencyLabels[link.dependency.subsystem],
      message: dependency.detail,
    } as const;
  }

  const statusLabel = dependency.status ?? "unknown";
  const detail =
    dependency.detail ?? `${link.dependency.label ?? dependencyLabels[link.dependency.subsystem]} subsystem ${statusLabel.toLowerCase()}`;

  if (canOpenWithData) {
    return {
      status: statusLabel,
      isActive: true,
      message: detail,
      dependencyStatus,
      dependencyLabel: link.dependency.label ?? dependencyLabels[link.dependency.subsystem],
    } as const;
  }

  return {
    status: statusLabel,
    isActive: false,
    message: detail,
    dependencyStatus,
    dependencyLabel: link.dependency.label ?? dependencyLabels[link.dependency.subsystem],
  } as const;
}

function formatDependencyStatus(status: SubsystemState) {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Waiting";
    case "error":
      return "Fault";
    default:
      return "Status unavailable";
  }
}

export default async function Home() {
  const [uiEnabled, systemStatus, executionState, metrics] = await Promise.all([
    isFeatureEnabled(FEATURE_FLAGS.UI_BLOCKS),
    getSystemStatus(),
    getSystemExecutionState(),
    getHomeCardMetrics(),
  ]);

  const links = buildLinks(metrics);
  const coreLinks = links.slice(0, 3);
  const dataLinks = links.slice(3);
  const heartbeat = heartbeatStyles[executionState.state];

  const renderLinkCard = (link: HomeLink) => {
    const dependencyState = getDependencyState(link, systemStatus);
<<<<<<< ours
    const badgeState = dependencyState.status;
    const isActive = dependencyState.isActive;
    const dependencyMessage =
      dependencyState.message ?? `${link.label} depends on ${dependencyLabels[link.dependency?.subsystem ?? "agents"]}`;
    const railState = (link.dependency
      ? dependencyState.dependencyStatus ?? "unknown"
      : badgeState) as BadgeState;
=======
    const cardState = getCardState(dependencyState, executionState);
    const isActive = cardState !== "disabled";
>>>>>>> theirs

    return (
      <Link
        key={link.href}
        href={link.href}
        className={`group relative overflow-hidden rounded-2xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm ring-1 ring-transparent transition backdrop-blur dark:border-indigo-900/40 dark:bg-zinc-900/80 ${
          isActive
            ? "cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:ring-indigo-200 dark:hover:ring-indigo-800"
            : "cursor-not-allowed pointer-events-none opacity-60"
        }`}
        aria-disabled={!isActive}
        tabIndex={isActive ? 0 : -1}
      >
        <div
<<<<<<< ours
          className={`absolute inset-x-6 top-0 h-1 rounded-full bg-gradient-to-r ${stateRailStyles[railState]}`}
=======
          className={`absolute inset-x-6 top-0 h-1 rounded-full opacity-80 ${cardStateStyles[cardState].rail}`}
>>>>>>> theirs
          aria-hidden
        />

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500 dark:text-indigo-300">Workflow</p>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{link.label}</h2>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {link.description ?? `${link.label} workflow`}
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold leading-none shadow-sm ${cardStateStyles[cardState].chip}`}>
            {formatStatusText(cardState)}
          </span>
        </div>

        {link.stats ? (
          <dl className="mt-4 grid gap-2 sm:grid-cols-2">
            {link.stats.map((stat) => (
              <div key={stat.label} className="flex flex-col rounded-xl border border-indigo-100/80 bg-indigo-50/40 px-3 py-2 dark:border-indigo-900/30 dark:bg-indigo-950/30">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-200">{stat.label}</dt>
                <dd className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{stat.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-3">
          {link.dependency ? (
            <div className={`inline-flex flex-col gap-1 rounded-2xl border px-3 py-2 text-sm shadow-sm ${dependencyStatusStyles[dependencyState.dependencyStatus ?? "unknown"]}`}>
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-200">LINKED SUBSYSTEM</span>
              <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                <span className={`h-2.5 w-2.5 rounded-full ${dependencyDotStyles[dependencyState.dependencyStatus ?? "unknown"]}`} aria-hidden />
                <span>{dependencyState.dependencyLabel ?? dependencyLabels[link.dependency.subsystem]}</span>
                <span className={`text-xs font-semibold ${dependencyStatusTextStyles[dependencyState.dependencyStatus ?? "unknown"]}`}>
                  · {formatDependencyStatus(dependencyState.dependencyStatus ?? "unknown")}
                </span>
              </div>
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200/80">{dependencyMessage}</p>
            </div>
          ) : (
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">LINKED SUBSYSTEM</div>
          )}

          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-indigo-700">
            <span>{link.cta}</span>
            <svg
              aria-hidden
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </div>
        </div>
      </Link>
    );
  };

  if (!uiEnabled) {
    return (
      <EATClientLayout contentClassName="flex flex-col gap-6" maxWidthClassName="max-w-6xl">
        <header className="mt-2 flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600">EAT</p>
              <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">EAT – Talent System (MVP)</h1>
            </div>
<<<<<<< ours
            <div className="flex items-center gap-2 self-start">
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] shadow-sm ${heartbeat.badge}`}
                title={`Current system state: ${heartbeat.label}`}
                aria-label={`Current system state: ${heartbeat.label}`}
              >
                <span className={`h-2 w-2 rounded-full ${heartbeat.dot}`} aria-hidden />
                <span>{heartbeat.label}</span>
              </div>
              <Link
                href="/system-map"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700 hover:shadow-lg"
              >
                System Map
              </Link>
            </div>
=======
            <Link
              href="/system-map"
              title="View agents, data flows, and dependencies"
              className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-indigo-200 bg-white/90 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-md transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 hover:shadow-lg"
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500 shadow-sm" aria-hidden />
              System Map
            </Link>
>>>>>>> theirs
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-zinc-600">
            <span className="block">Real-time orchestration for intelligent hiring systems.</span>
            <span className="block text-sm text-zinc-500">Agents, data, and decisioning in one control plane.</span>
          </p>
          <p className="max-w-2xl text-lg text-zinc-600">
            UI blocks are turned off. Enable the UI Blocks flag to restore navigation and workflows.
          </p>
          <Link href="/admin/feature-flags" className="text-sm font-semibold text-indigo-700 underline">
            Go to Feature Flags
          </Link>
        </header>
      </EATClientLayout>
    );
  }

  return (
    <EATClientLayout maxWidthClassName="max-w-6xl" contentClassName="flex flex-col gap-10 pb-12">
      <header className="mt-2 overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/60 dark:via-zinc-950 dark:to-emerald-950/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">EAT</p>
            <h1 className="text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">EAT – Talent System (MVP)</h1>
            <p className="max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
              <span className="block">Real-time orchestration for intelligent hiring systems.</span>
              <span className="block text-sm text-zinc-500 dark:text-zinc-400">Agents, data, and decisioning in one control plane.</span>
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-300">
              <span className="rounded-full bg-white/70 px-3 py-1 ring-1 ring-indigo-100 dark:bg-indigo-950/50 dark:ring-indigo-800">Agents</span>
              <span className="rounded-full bg-white/70 px-3 py-1 ring-1 ring-indigo-100 dark:bg-indigo-950/50 dark:ring-indigo-800">Workflows</span>
              <span className="rounded-full bg-white/70 px-3 py-1 ring-1 ring-indigo-100 dark:bg-indigo-950/50 dark:ring-indigo-800">Data + Controls</span>
            </div>
          </div>
<<<<<<< ours
          <div className="flex items-center gap-3 self-start">
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] shadow-sm ${heartbeat.badge}`}
              title={`Current system state: ${heartbeat.label}`}
              aria-label={`Current system state: ${heartbeat.label}`}
            >
              <span className={`h-2 w-2 rounded-full ${heartbeat.dot}`} aria-hidden />
              <span>{heartbeat.label}</span>
            </div>
            <Link
              href="/system-map"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 hover:shadow-lg dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-200 dark:hover:border-indigo-700"
            >
              System Map
            </Link>
          </div>
=======
          <Link
            href="/system-map"
            title="View agents, data flows, and dependencies"
            className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-indigo-200 bg-white/90 px-5 py-2 text-sm font-semibold text-indigo-700 shadow-md transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 hover:shadow-lg dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-200 dark:hover:border-indigo-700"
          >
            <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500 shadow-sm" aria-hidden />
            <span className="text-[13px] uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">System Map</span>
          </Link>
>>>>>>> theirs
        </div>
      </header>

      <SystemHealthPanel initialStatus={systemStatus} initialExecutionState={executionState} />

      <div className="space-y-6">
        <section className="rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Core workflows</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Launch and monitor the everyday agent actions.</p>
          </div>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{coreLinks.map(renderLinkCard)}</div>
        </section>

        <section className="rounded-3xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/70">
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Data &amp; controls</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Review the information that feeds the system.</p>
          </div>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{dataLinks.map(renderLinkCard)}</div>
        </section>
      </div>
    </EATClientLayout>
  );
}
