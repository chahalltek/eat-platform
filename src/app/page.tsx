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
import { ETEClientLayout } from "@/components/ETEClientLayout";
import { BrandMark } from "@/components/BrandMark";
import { AgentAvailabilityHints } from "@/components/AgentAvailabilityHints";
import { getHomeCardMetrics, type HomeCardMetrics } from "@/lib/metrics/home";
import { WorkflowCard } from "@/components/home/WorkflowCard";
import { getCurrentTenantId } from "@/lib/tenant";
import { BRANDING } from "@/config/branding";
import { getCurrentUser } from "@/lib/auth/user";
import { isAdminRole, normalizeRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type BadgeState = "enabled" | SubsystemState;

type HomeLink = {
  label: string;
  cta: string;
  href: string;
  description?: string;
  stats?: { label: string; value: string }[];
  executionSummary?: {
    runsLast7d: number | null;
    lastRunAt: string | null;
    failedRunsLast7d: number | null;
  };
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

function formatExecutionTimestamp(value: string | null) {
  if (!value) return "Not yet recorded";
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

const dependencyLabels: Record<SubsystemKey, string> = {
  agents: "Agents",
  scoring: "Scoring Engine",
  database: "Database",
  guardrails: "Guardrails",
  tenantConfig: "Tenant Config",
};

const badgeStyles: Record<BadgeState, string> = {
  enabled: "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-zinc-900 dark:text-slate-100",
  healthy: "border-emerald-200 bg-white text-emerald-800 dark:border-emerald-800 dark:bg-zinc-900 dark:text-emerald-200",
  warning: "border-amber-200 bg-white text-amber-800 dark:border-amber-800 dark:bg-zinc-900 dark:text-amber-200",
  error: "border-rose-200 bg-white text-rose-800 dark:border-rose-800 dark:bg-zinc-900 dark:text-rose-200",
  unknown: "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-zinc-900 dark:text-slate-100",
};

function buildLinks(metrics: HomeCardMetrics, tenantId: string): HomeLink[] {
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
      executionSummary: {
        runsLast7d: metrics.agentRunsLast7d,
        lastRunAt: metrics.lastAgentRunAt,
        failedRunsLast7d: metrics.failedAgentRunsLast7d,
      },
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
      label: "Admin",
      cta: "Configure",
      href: `/admin/tenant/${tenantId}/guardrails`,
      description: "Guardrails, Feature Flags, and MVP Test Plan",
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

function TelemetryMetric({
  label,
  value,
  href,
}: {
  label: string;
  value: number | null;
  href?: string | null;
}) {
  const displayValue = value == null ? "—" : value.toLocaleString();
  const isLinkEnabled = href && value !== null && value > 0;

  const content = (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">
          {label}
        </span>
        <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{displayValue}</span>
      </div>
      {isLinkEnabled ? (
        <span className="text-xs font-semibold text-slate-600 transition group-hover:translate-x-0.5 dark:text-slate-200">
          View
        </span>
      ) : null}
    </div>
  );

  const sharedClassName =
    "group flex h-full flex-1 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm transition hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-zinc-900 dark:hover:border-slate-700";

  if (isLinkEnabled) {
    return (
      <Link href={href!} className={sharedClassName} title={value == null ? "Telemetry unavailable" : undefined}>
        {content}
      </Link>
    );
  }

  return (
    <div
      className={`${sharedClassName} ${value == null ? "opacity-70" : ""}`}
      title={value == null ? "Telemetry unavailable" : undefined}
    >
      {content}
    </div>
  );
}

export default async function Home() {
  const [uiEnabled, systemStatus, executionState, metrics, tenantId, currentUser] = await Promise.all([
    isFeatureEnabled(FEATURE_FLAGS.UI_BLOCKS),
    getSystemStatus(),
    getSystemExecutionState(),
    getHomeCardMetrics(),
    getCurrentTenantId(),
    getCurrentUser(),
  ]);

  const links = buildLinks(metrics, tenantId);
  const coreLinks = links.slice(0, 3);
  const dataLinks = links.slice(3);
  const canResetDegraded = isAdminRole(normalizeRole(currentUser?.role));

  const renderLinkCard = (link: HomeLink) => {
    const dependencyState = getDependencyState(link, systemStatus);
    const isExecutionHistory = link.label === "Execution history";
    const runsLast7d = link.executionSummary?.runsLast7d ?? 0;
    const hasRuns = runsLast7d > 0;
    const lastRunAt = link.executionSummary?.lastRunAt ?? null;
    const failuresLast7d = link.executionSummary?.failedRunsLast7d ?? 0;
    const hasFailures = failuresLast7d > 0;
    const badgeState: BadgeState = isExecutionHistory && hasFailures ? "error" : dependencyState.status;

    const statusPanel = isExecutionHistory ? (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="font-semibold text-slate-900 dark:text-zinc-100">
          {hasRuns
            ? `Runs in last 7 days: ${runsLast7d.toLocaleString()}`
            : "System idle — no executions detected in the last 7 days."}
        </p>
        {hasRuns ? (
          <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">Last run: {formatExecutionTimestamp(lastRunAt)}</p>
        ) : null}
      </div>
    ) : null;

    const alert = hasFailures
      ? { title: "Recent failures detected", description: "Inspect execution logs.", tone: "error" as const }
      : undefined;

    return (
      <WorkflowCard
        key={link.href}
        link={link}
        badgeState={badgeState}
        dependencyState={dependencyState}
        badgeStyles={badgeStyles}
        dependencyLabels={dependencyLabels}
        statusPanel={statusPanel}
        statusChips={link.stats}
        alert={alert}
      />
    );
  };

  if (!uiEnabled) {
    return (
      <ETEClientLayout contentClassName="flex flex-col gap-6" maxWidthClassName="max-w-6xl">
        <header className="mt-2 flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <BrandMark withText />
                <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{BRANDING.name}</h1>
              </div>
            <Link
              href="/system-map"
              title="View agents, data flows, and dependencies"
              className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-indigo-200 bg-white/90 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-md transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 hover:shadow-lg"
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500 shadow-sm" aria-hidden />
              System Map
            </Link>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-zinc-600">
            <span className="block">{BRANDING.description}</span>
            <span className="block text-sm text-zinc-500">{BRANDING.tagline}</span>
          </p>
          <p className="max-w-2xl text-lg text-zinc-600">
            UI blocks are turned off. Enable the UI Blocks flag to restore navigation and workflows.
          </p>
          <Link href="/admin/feature-flags" className="text-sm font-semibold text-indigo-700 underline">
            Go to Feature Flags
          </Link>
        </header>
      </ETEClientLayout>
    );
  }

  return (
    <ETEClientLayout maxWidthClassName="max-w-6xl" contentClassName="flex flex-col gap-10 pb-12">
      <div className="flex flex-col gap-6">
        <div className="flex flex-1 flex-col gap-6">
          <header className="mt-2 overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3">
                <BrandMark withText />
                <div className="flex flex-col gap-2">
                  <h1 className="text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">{BRANDING.name}</h1>
                  <p className="max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
                    <span className="block">{BRANDING.description}</span>
                    <span className="block text-sm text-zinc-500 dark:text-zinc-400">{BRANDING.tagline}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                  <span className="rounded-full bg-slate-50 px-3 py-1 ring-1 ring-slate-200 dark:bg-zinc-800 dark:ring-slate-700">Agents</span>
                  <span className="rounded-full bg-slate-50 px-3 py-1 ring-1 ring-slate-200 dark:bg-zinc-800 dark:ring-slate-700">Workflows</span>
                  <span className="rounded-full bg-slate-50 px-3 py-1 ring-1 ring-slate-200 dark:bg-zinc-800 dark:ring-slate-700">Data + Controls</span>
                </div>
              </div>
              <Link
                href="/system-map"
                title="View agents, data flows, and dependencies"
                className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-zinc-800 dark:text-slate-100 dark:hover:border-slate-600"
              >
                <span className="inline-flex h-2 w-2 rounded-full bg-slate-400 shadow-sm" aria-hidden />
                <span className="text-[13px] uppercase tracking-[0.14em] text-slate-700 dark:text-slate-200">System Map</span>
              </Link>
            </div>
          </header>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-300">
                  Telemetry
                </span>
                <span className="text-xs text-slate-600 dark:text-zinc-400">Live activity snapshot</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <TelemetryMetric label="Agents online" value={metrics.telemetry.agentsOnline} />
              <TelemetryMetric label="Agents executed today" value={metrics.telemetry.agentsExecutedToday} />
              <TelemetryMetric
                label="Incidents in last 24h"
                value={metrics.telemetry.incidentsLast24h}
                href="/agents/runs?status=failed&range=24h"
              />
            </div>
          </section>

          <SystemHealthPanel
            initialStatus={systemStatus}
            initialExecutionState={executionState}
            canResetDegraded={canResetDegraded}
          />

          <AgentAvailabilityHints />

          <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-zinc-900">
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-300">Core workflows</p>
                <p className="text-sm text-slate-600 dark:text-zinc-400">Launch and monitor the everyday agent actions.</p>
              </div>
              <div className="mt-4 grid content-start gap-6 sm:grid-cols-2 lg:grid-cols-3">{coreLinks.map(renderLinkCard)}</div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-zinc-900">
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-300">Data &amp; controls</p>
                <p className="text-sm text-slate-600 dark:text-zinc-400">Review the information that feeds the system.</p>
              </div>
              <div className="mt-4 grid content-start gap-6 sm:grid-cols-2 lg:grid-cols-3">{dataLinks.map(renderLinkCard)}</div>
            </section>
          </div>
        </div>
      </div>
    </ETEClientLayout>
  );
}
