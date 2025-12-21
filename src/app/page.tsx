import Link from "next/link";

import { FEATURE_FLAGS, isFeatureEnabled } from "@/lib/featureFlags";
import {
  getSystemExecutionState,
  getSystemStatus,
  type SystemStatus,
  type SubsystemKey,
  type SubsystemState,
  type SystemStatusMap,
} from "@/lib/systemStatus";
import { SystemHealthPanel } from "@/components/SystemHealthPanel";
import { ETEClientLayout } from "@/components/ETEClientLayout";
import { BrandMark } from "@/components/BrandMark";
import { AgentAvailabilityHints } from "@/components/AgentAvailabilityHints";
import { getHomeCardMetrics, type HomeCardMetrics, type HomeTelemetryMetrics } from "@/lib/metrics/home";
import { WorkflowCard, type WorkflowCardState } from "@/components/home/WorkflowCard";
import { getCurrentTenantId } from "@/lib/tenant";
import { BRANDING } from "@/config/branding";
import { getCurrentUser } from "@/lib/auth/user";
import { isAdminRole, normalizeRole } from "@/lib/auth/roles";
import { canViewFulfillmentNav } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type BadgeState = "enabled" | "idle" | SubsystemState;

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
  idle: "border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-zinc-900 dark:text-slate-50",
  healthy: "border-emerald-200 bg-white text-emerald-800 dark:border-emerald-800 dark:bg-zinc-900 dark:text-emerald-200",
  warning: "border-amber-200 bg-white text-amber-800 dark:border-amber-800 dark:bg-zinc-900 dark:text-amber-200",
  error: "border-rose-200 bg-white text-rose-800 dark:border-rose-800 dark:bg-zinc-900 dark:text-rose-200",
  unknown: "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-zinc-900 dark:text-slate-100",
};

function getTelemetrySummary(telemetry: HomeTelemetryMetrics) {
  const incidents = telemetry.incidentsLast24h ?? 0;
  const executedToday = telemetry.agentsExecutedToday ?? 0;

  if (incidents > 0) return "Status: Attention needed — incidents detected in last 24h.";
  if (executedToday > 0) return "Status: Active — agents executed today.";
  return "Status: Healthy and idle — no agent executions today.";
}

function buildFulfillmentLinks(metrics: HomeCardMetrics): HomeLink[] {
  return [
    {
      label: "Create intake",
      cta: "Launch intake",
      href: "/intake",
      description: "RUA — Job intake agent",
      dependency: { subsystem: "agents" },
    },
    {
      label: "Upload resumes",
      cta: "Ingest resumes",
      href: "/resumes/upload",
      description: "RINA — Resume ingestion agent",
      dependency: { subsystem: "agents" },
    },
    {
      label: "Match results",
      cta: "Review matches",
      href: "/matches",
      description: "Ranked candidates per job",
      dependency: { subsystem: "agents", flow: { source: "Match results", target: "Matcher" } },
    },
    {
      label: "Explain",
      cta: "Generate rationale",
      href: "/explain",
      description: "Explain why a candidate was ranked",
      dependency: { subsystem: "agents", flow: { source: "Explain", target: "Explain agent" } },
    },
    {
      label: "Confidence",
      cta: "Assess reliability",
      href: "/confidence",
      description: "Confidence buckets for matches",
      dependency: { subsystem: "agents", flow: { source: "Confidence", target: "Confidence agent" } },
    },
    {
      label: "Shortlist",
      cta: "Export shortlist",
      href: "/shortlist",
      description: "Top candidates ready to submit",
      dependency: { subsystem: "agents", flow: { source: "Shortlist", target: "Shortlist agent" } },
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
  ];
}

function buildAdminLinks(metrics: HomeCardMetrics, tenantId: string): HomeLink[] {
  return [
    {
      label: "Telemetry / System status",
      cta: "View diagnostics",
      href: `/admin/tenant/${tenantId}/diagnostics`,
      description: "Live telemetry, incidents, and audit signals",
      dependency: { subsystem: "tenantConfig" },
    },
    {
      label: "Runtime controls",
      cta: "Adjust settings",
      href: `/admin/tenant/${tenantId}/ops/runtime-controls`,
      description: "Manage runtime guardrails and feature flags",
      dependency: { subsystem: "tenantConfig" },
    },
    {
      label: "Guardrails & feature flags",
      cta: "Configure",
      href: `/admin/tenant/${tenantId}/guardrails`,
      description: "Configure guardrails and feature controls",
      dependency: { subsystem: "tenantConfig" },
    },
    {
      label: "Test runner",
      cta: "Run tests",
      href: `/admin/tenant/${tenantId}/ops/test-runner/ete`,
      description: "End-to-end verification",
      dependency: { subsystem: "agents" },
    },
    {
      label: "MVP test plan",
      cta: "Open checklist",
      href: "/admin/ete/test-plan",
      description: "Release gates for the ETE MVP (interactive checklist)",
      dependency: { subsystem: "tenantConfig" },
    },
    {
      label: "Execution history",
      cta: "Trace executions",
      href: "/executions",
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
      label: "System map",
      cta: "View topology",
      href: "/system-map",
      description: "Agents, data flows, and dependencies",
      dependency: { subsystem: "agents" },
    },
  ];
}

function getDependencyState(link: HomeLink, statusMap: SystemStatusMap): WorkflowCardState {
  if (!link.dependency) {
    return { status: "enabled", isActive: true } as const;
  }

  const dependency: SystemStatus = statusMap[link.dependency.subsystem] ?? { status: "unknown" };
  const dependencyStatus: WorkflowCardState["dependencyStatus"] = dependency.status ?? "unknown";
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

  const statusLabel: SubsystemState = dependency.status ?? "unknown";
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

  const productName = BRANDING.name;
  const productNameWithMark = productName.includes("EDGE Talent Engine") ? "EDGE Talent Engine™" : productName;
  const heroDescription = BRANDING.description.includes(productName)
    ? BRANDING.description.replace(productName, productNameWithMark)
    : BRANDING.description.replace("EDGE Talent Engine", productNameWithMark);
  const telemetrySummary = getTelemetrySummary(metrics.telemetry);
  const isIdleExecution = executionState.state === "idle";
  const hasRunsInLastWeek = (metrics.agentRunsLast7d ?? 0) > 0;
  const isIdleContext = isIdleExecution && !hasRunsInLastWeek;

  const fulfillmentLinks = buildFulfillmentLinks(metrics);
  const adminLinks = buildAdminLinks(metrics, tenantId);
  const normalizedRole = normalizeRole(currentUser?.role);
  const canResetDegraded = isAdminRole(normalizedRole);
  const isAdmin = isAdminRole(normalizedRole);
  const showFulfillmentWorkspace = canViewFulfillmentNav(currentUser, tenantId) || isAdmin;
  const showAdminWorkspace = isAdmin;

  const renderLinkCard = (link: HomeLink) => {
    const dependencyState: WorkflowCardState = getDependencyState(link, systemStatus);
    const isExecutionHistory = link.label === "Execution history";
    const runsLast7d = link.executionSummary?.runsLast7d ?? 0;
    const hasRuns = runsLast7d > 0;
    const lastRunAt = link.executionSummary?.lastRunAt ?? null;
    const failuresLast7d = link.executionSummary?.failedRunsLast7d ?? 0;
    const hasFailures = failuresLast7d > 0;
    const isIdleExecutionHistory = isExecutionHistory && !hasRuns && isIdleContext;
    const badgeState: BadgeState = isExecutionHistory && hasFailures ? "error" : isIdleExecutionHistory ? "idle" : dependencyState.status;
    const safeTestHref = "/rua-test?source=telemetry&mode=test";

    const statusPanel = isExecutionHistory ? (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="font-semibold text-slate-900 dark:text-zinc-100">
          {hasRuns
            ? `Runs in last 7 days: ${runsLast7d.toLocaleString()}`
            : "System idle — no executions detected in the last 7 days."}
        </p>
        {hasRuns ? (
          <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">Last run: {formatExecutionTimestamp(lastRunAt)}</p>
        ) : (
          <div className="mt-3 space-y-2 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-zinc-900/80">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200">
              Recommended next step
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-200">
              Run a safe test workflow to validate end-to-end execution and confirm dependencies.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={safeTestHref}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                Run test execution
              </Link>
              {lastRunAt ? (
                <Link
                  href="/agents/runs"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-slate-700 dark:bg-zinc-800 dark:text-slate-100 dark:hover:border-slate-600"
                >
                  View last run
                </Link>
              ) : null}
            </div>
          </div>
        )}
      </div>
    ) : null;

    const alert = hasFailures
      ? { title: "Recent failures detected", description: "Inspect execution logs.", tone: "error" as const }
      : undefined;
    const cardBadgeState: BadgeState =
      isIdleContext && dependencyState.status === "enabled" && !hasFailures ? "idle" : badgeState;
    const dependencyStatus: SubsystemState | "idle" =
      isIdleContext && dependencyState.dependencyStatus === "healthy"
        ? "idle"
        : dependencyState.dependencyStatus ?? "unknown";
    const dependencyLabel =
      dependencyState.dependencyLabel ?? dependencyLabels[link.dependency?.subsystem ?? "agents"];
    const dependencyMessage =
      dependencyState.message ??
      (isIdleContext ? "Ready to run — platform is healthy but idle." : `${link.label} depends on ${dependencyLabel}`);
    const normalizedDependencyState: WorkflowCardState = {
      ...dependencyState,
      dependencyStatus,
      message: dependencyMessage,
      status: cardBadgeState === "idle" ? "idle" : dependencyState.status,
    };

    return (
      <WorkflowCard
        key={link.href}
        link={link}
        badgeState={cardBadgeState}
        dependencyState={normalizedDependencyState}
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
                <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{productNameWithMark}</h1>
              </div>
            <Link
              href="/system-map"
              title="View agents, data flows, and dependencies"
              className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-indigo-200 bg-white/90 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-md transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 hover:shadow-lg"
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500 shadow-sm" aria-hidden />
              <span className="text-[13px] font-semibold tracking-[0.14em] text-indigo-700">
                <span className="uppercase">System Map</span>
                <span className="ml-1 text-[11px] font-medium tracking-normal text-indigo-500">· How ETE thinks</span>
              </span>
            </Link>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="max-w-2xl text-base font-semibold leading-relaxed text-zinc-700">
              {heroDescription}
            </p>
            {BRANDING.tagline ? <p className="text-sm font-medium text-zinc-500">{BRANDING.tagline}</p> : null}
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">EDGE Talent Engine™ is a product of Strategic Systems.</p>
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
                <div className="flex flex-col gap-3">
                  <h1 className="text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">{productNameWithMark}</h1>
                  <div className="flex flex-col gap-1.5">
                    <p className="max-w-2xl text-lg font-semibold leading-relaxed text-zinc-900 dark:text-zinc-100">
                      {heroDescription}
                    </p>
                    {BRANDING.tagline ? (
                      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{BRANDING.tagline}</p>
                    ) : null}
                  </div>
                  <p className="max-w-3xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
                    ETE is an agentic decision-support system where specialized agents reason at key moments, humans retain authority, and
                    the system preserves judgment as durable memory.
                  </p>
                </div>
                <div
                  className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300"
                  role="tablist"
                  aria-label="EDGE Talent Engine navigation"
                >
                  <span
                    role="tab"
                    aria-selected="false"
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-zinc-800 dark:text-slate-200 dark:hover:border-slate-600"
                  >
                    Agents
                  </span>
                  <span
                    role="tab"
                    aria-selected="true"
                    className="inline-flex items-center rounded-full border border-indigo-500 bg-indigo-600 px-4 py-1.5 text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-indigo-400 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                  >
                    Workflows
                  </span>
                  <span
                    role="tab"
                    aria-selected="false"
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-zinc-800 dark:text-slate-200 dark:hover:border-slate-600"
                  >
                    Data + Controls
                  </span>
                </div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-500">
                  EDGE Talent Engine™ is a product of Strategic Systems.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Link
                  href="/help"
                  title="Read quick answers and explainers"
                  className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-zinc-800 dark:text-slate-100 dark:hover:border-slate-600"
                >
                  <span className="inline-flex h-2 w-2 rounded-full bg-indigo-400 shadow-sm" aria-hidden />
                  <span className="text-[13px] uppercase tracking-[0.14em] text-slate-700 dark:text-slate-200">Help / FAQ</span>
                </Link>
                <Link
                  href="/system-map"
                  title="View agents, data flows, and dependencies"
                  className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-zinc-800 dark:text-slate-100 dark:hover:border-slate-600"
                >
                  <span className="inline-flex h-2 w-2 rounded-full bg-slate-400 shadow-sm" aria-hidden />
                  <span className="text-[13px] font-semibold tracking-[0.14em] text-slate-700 dark:text-slate-200">
                    <span className="uppercase">System Map</span>
                    <span className="ml-1 text-[11px] font-medium tracking-normal text-slate-500 dark:text-slate-300">
                      · How ETE thinks
                    </span>
                  </span>
                </Link>
              </div>
            </div>
          </header>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-300">
                  Telemetry
                </span>
                <span className="text-xs text-slate-600 dark:text-zinc-400">Live activity snapshot</span>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{telemetrySummary}</p>
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
            {showFulfillmentWorkspace ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-zinc-900">
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-300">Fulfillment workspace</p>
                  <p className="text-sm text-slate-600 dark:text-zinc-400">The workflows recruiters and sourcers use to intake, match, explain, and submit.</p>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-semibold text-slate-700 dark:border-slate-800 dark:bg-zinc-800 dark:text-slate-200">
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
                    <span>Work area: use these workflows for real recruiting decisions.</span>
                  </div>
                </div>
                <div className="mt-4 grid content-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {fulfillmentLinks.map(renderLinkCard)}
                </div>
              </section>
            ) : null}

            {showAdminWorkspace ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-zinc-900">
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-300">Admin &amp; ops</p>
                  <p className="text-sm text-slate-600 dark:text-zinc-400">Controls, diagnostics, and verification tools. Use intentionally.</p>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[12px] font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    <span className="inline-flex h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                    <span>Admin area: changes are logged and may affect tenant behavior.</span>
                  </div>
                </div>
                <div className="mt-4 grid content-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {adminLinks.map(renderLinkCard)}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </ETEClientLayout>
  );
}
