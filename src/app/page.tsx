import Link from "next/link";

import { FEATURE_FLAGS, isFeatureEnabled } from "@/lib/featureFlags";
import {
  getSystemStatus,
  type SubsystemKey,
  type SubsystemState,
  type SystemStatusMap,
} from "@/lib/systemStatus";
import { SystemStatus } from "@/components/SystemStatus";
import { EATCard } from "@/components/EATCard";
import { StatusPill } from "@/components/StatusPill";
import { getHomeCardMetrics, type HomeCardMetrics } from "@/lib/metrics/home";
<<<<<<< ours
import { EATClientLayout } from "@/components/EATClientLayout";
=======
import { StatusPill, type Status } from "@/components/StatusPill";
>>>>>>> theirs

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type HomeLink = {
  label: string;
  href: string;
  description?: string;
  stats?: { label: string; value: string }[];
  dependency?: {
    subsystem: SubsystemKey;
    allowWhenDataPresent?: boolean;
    dataCount?: number | null;
  };
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

const dependencyLabels: Record<SubsystemKey, string> = {
  agents: "Agents",
  scoring: "Scoring Engine",
  database: "Database",
  tenantConfig: "Tenant Config",
};

type BadgeState = "enabled" | SubsystemState;

function formatStatusText(status: BadgeState) {
  switch (status) {
    case "enabled":
      return "Enabled";
    case "healthy":
      return "Enabled";
    case "warning":
      return "Setup required";
    case "error":
      return "Unavailable";
    case "unknown":
      return "Status unknown";
    default:
      return "Status unknown";
  }
}

const messageStyles: Record<string, string> = {
  warning: "text-amber-700 dark:text-amber-200",
  error: "text-rose-700 dark:text-rose-200",
  unknown: "text-zinc-600 dark:text-zinc-400",
};

function buildLinks(metrics: HomeCardMetrics): HomeLink[] {
  return [
    {
      label: "Upload and parse resume",
      href: "/rina-test",
      description: "RINA — Resume ingestion agent",
      dependency: { subsystem: "agents" },
    },
    {
      label: "Create job intake",
      href: "/rua-test",
      description: "RUA — Job intake agent",
      dependency: { subsystem: "agents" },
    },
    {
      label: "Execution history",
      href: "/agents/runs",
      description: "Latest agent runs",
      stats: [{ label: "Agent runs in last 7 days", value: formatAgentRuns(metrics.agentRunsLast7d) }],
      dependency: { subsystem: "agents" },
    },
    {
      label: "Job library",
      href: "/jobs",
      description: "Roles with scoring",
      stats: [
        { label: "Job library", value: formatCount(metrics.totalJobs) },
        { label: "Roles with test content", value: formatCount(metrics.testContentRoles) },
      ],
      dependency: { subsystem: "scoring", allowWhenDataPresent: true, dataCount: metrics.totalJobs },
    },
    {
      label: "Candidate pool",
      href: "/candidates",
      description: "Candidate library",
      stats: [{ label: "Candidate pool", value: formatCount(metrics.totalCandidates) }],
      dependency: { subsystem: "scoring", allowWhenDataPresent: true, dataCount: metrics.totalCandidates },
    },
    {
      label: "System controls",
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
      dependencyLabel: dependencyLabels[link.dependency.subsystem],
      message: dependency.detail,
    } as const;
  }

  const statusLabel = dependency.status ?? "unknown";
  const detail =
    dependency.detail ?? `${dependencyLabels[link.dependency.subsystem]} subsystem ${statusLabel.toLowerCase()}`;

  if (canOpenWithData) {
    return {
      status: statusLabel,
      isActive: true,
      message: detail,
      dependencyStatus,
      dependencyLabel: dependencyLabels[link.dependency.subsystem],
    } as const;
  }

  return {
    status: statusLabel,
    isActive: false,
    message: detail,
    dependencyStatus,
    dependencyLabel: dependencyLabels[link.dependency.subsystem],
  } as const;
}

function formatDependencyStatus(status: SubsystemState) {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Warning";
    case "error":
      return "Unavailable";
    default:
      return "Unknown";
  }
}

function dependencyStatusToPill(status: SubsystemState): Status {
  switch (status) {
    case "healthy":
      return "healthy";
    case "warning":
      return "degraded";
    case "error":
      return "down";
    case "unknown":
    default:
      return "unknown";
  }
}

export default async function Home() {
  const [uiEnabled, systemStatus, metrics] = await Promise.all([
    isFeatureEnabled(FEATURE_FLAGS.UI_BLOCKS),
    getSystemStatus(),
    getHomeCardMetrics(),
  ]);

  const links = buildLinks(metrics);

  if (!uiEnabled) {
    return (
<<<<<<< ours
      <EATClientLayout>
        <div className="flex flex-col gap-6">
          <header className="mt-2 flex flex-col gap-3">
=======
      <div className="min-h-screen bg-zinc-50 text-zinc-900">
        <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-16 sm:px-12">
          <header className="mt-8 flex flex-col gap-3 sm:mt-12">
>>>>>>> theirs
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600">EAT</p>
                <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">EAT – Talent System (MVP)</h1>
              </div>
              <Link
                href="/eat/about"
                className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700 hover:shadow-lg"
              >
                About EAT
              </Link>
            </div>
            <p className="max-w-2xl text-lg text-zinc-600">
              UI blocks are turned off. Enable the UI Blocks flag to restore navigation and workflows.
            </p>
            <Link href="/admin/feature-flags" className="text-sm font-semibold text-indigo-700 underline">
              Go to Feature Flags
            </Link>
          </header>
<<<<<<< ours
        </div>
      </EATClientLayout>
=======
        </main>
      </div>
>>>>>>> theirs
    );
  }

  return (
    <EATClientLayout>
      <div className="flex flex-col gap-12">
        <header className="mt-2 flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">EAT</p>
              <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">EAT – Talent System (MVP)</h1>
            </div>
            <Link
              href="/eat/about"
              className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-700/60"
            >
              About EAT
            </Link>
          </div>
          <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Control plane for AI-driven recruiting workflows across intake, scoring, and selection.
          </p>
        </header>

        <SystemStatus initialStatus={systemStatus} />

        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => {
            const dependencyState = getDependencyState(link, systemStatus);
            const badgeState = dependencyState.status;
            const isActive = dependencyState.isActive;
            const showMessage =
              dependencyState.message &&
              (badgeState !== "enabled" || dependencyState.message !== "Feature enabled");

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`group block ${isActive ? "" : "pointer-events-none cursor-not-allowed opacity-60"}`}
                aria-disabled={!isActive}
                tabIndex={isActive ? 0 : -1}
              >
                <EATCard
                  className={`h-full transition-transform ${isActive ? "hover:-translate-y-0.5" : ""}`}
                >
                  <div className="flex h-full flex-col gap-4">
                    <div className="mb-1 flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">{link.label}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {link.description ?? `${link.label} workflow`}
                        </p>
                      </div>
<<<<<<< ours
                    ))}
                  </dl>
                ) : null}
                {link.dependency ? (
                  <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 transition group-hover:border-indigo-100 group-hover:bg-indigo-50 dark:border-zinc-800 dark:bg-zinc-950 dark:group-hover:border-indigo-700/60 dark:group-hover:bg-indigo-900/20">
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <span className="uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Dependency</span>
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {dependencyState.dependencyLabel ?? dependencyLabels[link.dependency.subsystem]}
                        </span>
                      </div>
                      <StatusPill
                        status={dependencyStatusToPill(dependencyState.dependencyStatus ?? "unknown")}
                        label={formatDependencyStatus(dependencyState.dependencyStatus ?? "unknown")}
                      />
=======
                      <StatusPill status={badgeState} label={formatStatusText(badgeState)} />
>>>>>>> theirs
                    </div>

                    {link.stats ? (
                      <dl className="space-y-2">
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

                    {link.dependency ? (
                      <div className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 transition group-hover:border-indigo-100 group-hover:bg-indigo-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:group-hover:border-indigo-700/60 dark:group-hover:bg-indigo-900/20">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-200">Dependency</span>
                        <div
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-medium ${
                            dependencyStatusStyles[dependencyState.dependencyStatus ?? "unknown"]
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                          <span className="text-[11px] uppercase tracking-wide">
                            {dependencyState.dependencyLabel ?? dependencyLabels[link.dependency.subsystem]}
                          </span>
                          <span className="text-xs capitalize">
                            {formatDependencyStatus(dependencyState.dependencyStatus ?? "unknown")}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {showMessage ? (
                      <p className={`text-xs ${messageStyles[badgeState] ?? "text-zinc-500"}`}>
                        {dependencyState.message}
                      </p>
                    ) : null}
                  </div>
                </EATCard>
              </Link>
            );
          })}
        </section>
      </div>
    </EATClientLayout>
  );
}
