import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from "@heroicons/react/24/solid";

import { DEFAULT_TENANT_ID, ROLE_HEADER, USER_HEADER } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/user";
import { normalizeRole } from "@/lib/auth/roles";
import type { IdentityUser } from "@/lib/auth/types";
import { getCurrentTenantId } from "@/lib/tenant";
import {
  buildTenantDiagnostics,
  TenantNotFoundError,
  type TenantDiagnostics,
} from "@/lib/tenant/diagnostics";
import { getTenantMembershipsForUser, resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";
import { StatusPill } from "@/components/StatusPill";
import { ETECard } from "@/components/ETECard";
import { AdminCardTitle } from "@/components/admin/AdminCardTitle";
import { TenantTestTable } from "./TenantTestTable";
import { TenantFireDrillCallout } from "./TenantFireDrillCallout";
import { TenantAdminShell } from "../TenantAdminShell";

export const dynamic = "force-dynamic";

type Status = "ok" | "warn" | "off" | "fault";

type ModeValue = TenantDiagnostics["mode"] | { mode: TenantDiagnostics["mode"] };

function formatMode(mode: ModeValue) {
  const value = typeof mode === "string" ? mode : mode.mode;

  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusIcon({ status }: { status: Status }) {
  const classes = "h-5 w-5";

  if (status === "ok") return <CheckCircleIcon className={`${classes} text-green-600`} />;
  if (status === "warn") return <ExclamationTriangleIcon className={`${classes} text-amber-500`} />;
  return <XCircleIcon className={`${classes} text-rose-500`} />;
}

function DiagnosticCard({
  title,
  status,
  description,
  children,
}: {
  title: string;
  status: Status;
  description: string;
  children: ReactNode;
}) {
  const pillStatus =
    status === "warn" ? "warning" : status === "off" ? "off" : status === "fault" ? "fault" : "ok";
  const pillLabel =
    status === "warn"
      ? "Action needed"
      : status === "off"
        ? "Disabled"
        : status === "fault"
          ? "Fault"
          : "Enabled";

  return (
    <ETECard className="gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <StatusIcon status={status} />
          <div className="flex-1">
            <AdminCardTitle as="h3" className="text-base dark:text-zinc-50" stabilizeHeight>
              {title}
            </AdminCardTitle>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
          </div>
        </div>
        <StatusPill status={pillStatus} label={pillLabel} />
      </div>
      <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-100">
        {children}
      </div>
    </ETECard>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", year: "numeric" }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatGuardrailsPreset(preset: TenantDiagnostics["guardrailsPreset"]) {
  if (!preset) return "Custom (no preset selected)";
  return preset[0].toUpperCase() + preset.slice(1);
}

function mapLlmStatus(status: TenantDiagnostics["llm"]["status"]): Status {
  if (status === "ready") return "ok";
  if (status === "disabled") return "off";
  return "warn";
}

function mapAtsStatus(status: TenantDiagnostics["ats"]["status"]): Status {
  if (status === "success") return "ok";
  if (status === "running") return "warn";
  return "warn";
}

export default async function TenantDiagnosticsPage({ params }: { params: { tenantId?: string } }) {
  const [user, headerList] = await Promise.all([getCurrentUser(), headers()]);
  const requestedTenant = params.tenantId?.trim?.() ?? "";
  const headerRole = getTenantRoleFromHeaders(headerList);

  const headerUser: IdentityUser | null = (() => {
    const headerUserId = headerList.get(USER_HEADER)?.trim();
    if (!headerUserId) return null;

    const headerEmail = headerList.get("x-eat-user-email")?.trim() ?? null;
    const headerName = headerList.get("x-eat-user-name")?.trim() ?? headerEmail;
    const headerRoleValue = normalizeRole(headerList.get(ROLE_HEADER)) ?? null;

    return {
      id: headerUserId,
      email: headerEmail,
      displayName: headerName,
      role: headerRoleValue,
      tenantId: headerList.get("x-eat-tenant-id")?.trim() ?? DEFAULT_TENANT_ID,
    } satisfies IdentityUser;
  })();

  const resolvedUser = user ?? headerUser;

  if (!resolvedUser || !requestedTenant) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need to be a tenant admin for this workspace to view readiness diagnostics.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium text-amber-900 underline">
              Return to home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const [currentTenantId, access] = await Promise.all([
    getCurrentTenantId(),
    resolveTenantAdminAccess(resolvedUser, requestedTenant, { roleHint: headerRole }),
  ]);

  const normalizedCurrentTenantId = currentTenantId?.trim?.() ?? "";
  const isGlobalWithoutMembership = access.isGlobalAdmin && !access.membership;
  const bootstrapTenantId =
    access.isGlobalAdmin && requestedTenant === DEFAULT_TENANT_ID ? requestedTenant : null;

  if (!access.hasAccess && !access.isGlobalAdmin) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need to be a tenant admin for this workspace to view readiness diagnostics.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium text-amber-900 underline">
              Return to home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const tenantRoles = access.isGlobalAdmin
    ? await getTenantMembershipsForUser(resolvedUser.id)
    : access.membership
      ? [access.membership]
      : [];

  try {
    const diagnostics = await buildTenantDiagnostics(requestedTenant);
    const executionDisabled = Boolean(process.env.VERCEL);

    return (
      <TenantAdminShell tenantId={requestedTenant} bootstrapTenantId={bootstrapTenantId}>
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin</p>
              <h1 className="text-3xl font-semibold text-zinc-900">Tenant diagnostics</h1>
              <p className="text-sm text-zinc-600">Quickly confirm which enterprise features are active for this tenant.</p>
            </div>

            <Link
              href="/admin/tenants"
              className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
            >
              Back to tenants
            </Link>
          </header>

          {isGlobalWithoutMembership ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Limited membership context</p>
              <p>You are accessing this tenant as a global admin without explicit tenant membership.</p>
            </div>
          ) : null}

          <TenantFireDrillCallout fireDrill={diagnostics.fireDrill} />

          <TenantTestTable tenantId={requestedTenant} executionDisabled={executionDisabled} />

          <section className="grid gap-4 md:grid-cols-2">
            <DiagnosticCard
              title="ATS sync"
              status={mapAtsStatus(diagnostics.ats.status)}
              description="Latest ATS ingestion status and retry schedule."
            >
              <div className="space-y-2 text-sm">
                <p className="font-medium text-zinc-900 dark:text-zinc-50">Provider: {diagnostics.ats.provider}</p>
                <p className="text-xs text-zinc-700 dark:text-zinc-200">
                  Last sync: {diagnostics.ats.lastRunAt ? formatDateTime(diagnostics.ats.lastRunAt) : "No runs yet"}
                </p>
                {diagnostics.ats.summary ? (
                  <p className="text-xs text-zinc-700 dark:text-zinc-200">
                    Synced {diagnostics.ats.summary.jobsSynced} jobs / {diagnostics.ats.summary.candidatesSynced} candidates /
                    {" "}
                    {diagnostics.ats.summary.placementsSynced} placements
                  </p>
                ) : (
                  <p className="text-xs text-zinc-500">No ATS records have been synchronized yet.</p>
                )}
                {diagnostics.ats.errorMessage ? (
                  <p className="text-xs text-amber-700">Last error: {diagnostics.ats.errorMessage}</p>
                ) : (
                  <p className="text-xs text-zinc-500">No sync errors detected.</p>
                )}
                {diagnostics.ats.nextAttemptAt ? (
                  <p className="text-xs text-zinc-700 dark:text-zinc-200">
                    Next retry at {formatDateTime(diagnostics.ats.nextAttemptAt)} (retry {diagnostics.ats.retryCount})
                  </p>
                ) : null}
              </div>
            </DiagnosticCard>

            <DiagnosticCard
              title="System mode"
              status={diagnostics.fireDrill.enabled ? "warn" : "ok"}
              description="Current operating posture for this environment."
            >
              <div className="space-y-2 text-sm">
                <p>
                  Mode: <span className="font-semibold text-zinc-900 dark:text-zinc-50">{formatMode(diagnostics.mode)}</span>
                </p>
                {diagnostics.modeNotice ? (
                  <p className="text-xs text-amber-700">{diagnostics.modeNotice}</p>
                ) : null}
                {diagnostics.fireDrill.enabled ? (
                  <div className="space-y-1">
                    <p>Fire Drill safeguards are active. Impact:</p>
                    <ul className="list-disc pl-5 text-xs text-zinc-700 dark:text-zinc-200">
                      {diagnostics.fireDrill.fireDrillImpact.length > 0 ? (
                        diagnostics.fireDrill.fireDrillImpact.map((impact) => <li key={impact}>{impact}</li>)
                      ) : (
                        <li>No impact details were provided.</li>
                      )}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-700 dark:text-zinc-200">
                    Fire Drill is not active; automation and guardrails are running normally.
                  </p>
                )}
              </div>
            </DiagnosticCard>

            <DiagnosticCard
              title="Single sign-on"
              status={diagnostics.sso.configured ? "ok" : "off"}
              description={diagnostics.sso.configured ? "SSO is configured for this workspace." : "Enable SSO to centralize access controls."}
            >
              <p>
                {diagnostics.sso.configured
                  ? `Issuer: ${diagnostics.sso.issuerUrl}`
                  : "SSO client ID, secret, or issuer URL missing."}
              </p>
            </DiagnosticCard>

            <DiagnosticCard
              title="Guardrails"
              status={diagnostics.guardrailsStatus === "Guardrails healthy" ? "ok" : "warn"}
              description="Active safety preset and recommendation for agent behavior."
            >
              <div className="space-y-2">
                <div>
                  <p>Preset: {formatGuardrailsPreset(diagnostics.guardrailsPreset)}</p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-200">Status: {diagnostics.guardrailsStatus}</p>
                </div>
                {diagnostics.guardrailsRecommendation ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    Recommendation: {diagnostics.guardrailsRecommendation}
                  </p>
                ) : null}
              </div>
            </DiagnosticCard>

            <DiagnosticCard
              title="Config schema"
              status={diagnostics.configSchema.status === "ok" ? "ok" : "warn"}
              description="Tenant config table readiness for guardrails and LLM controls."
            >
              <div className="space-y-2 text-sm">
                <p>
                  {diagnostics.configSchema.status === "ok"
                    ? "Config schema matches guardrail expectations."
                    : "Config schema out of date; defaults applied where necessary."}
                </p>
                {diagnostics.configSchema.missingColumns.length > 0 ? (
                  <p className="text-xs text-amber-700">
                    Missing columns: {diagnostics.configSchema.missingColumns.join(", ")}
                  </p>
                ) : diagnostics.configSchema.reason ? (
                  <p className="text-xs text-amber-700">{diagnostics.configSchema.reason}</p>
                ) : null}
              </div>
            </DiagnosticCard>

            <DiagnosticCard
              title="Schema drift"
              status={diagnostics.schemaDrift.status === "ok" ? "ok" : "fault"}
              description="Checks TenantConfig columns for recent migrations."
            >
              <div className="space-y-2 text-sm">
                <p>
                  {diagnostics.schemaDrift.status === "ok"
                    ? "TenantConfig columns match expected schema."
                    : "Detected schema drift in TenantConfig; apply the latest migrations."}
                </p>
                {diagnostics.schemaDrift.missingColumns.length > 0 ? (
                  <p className="text-xs text-rose-700 dark:text-rose-300">
                    Missing columns: {diagnostics.schemaDrift.missingColumns.join(", ")}
                  </p>
                ) : diagnostics.schemaDrift.reason ? (
                  <p className="text-xs text-rose-700 dark:text-rose-300">{diagnostics.schemaDrift.reason}</p>
                ) : null}
              </div>
            </DiagnosticCard>

            <DiagnosticCard
              title="LLM provider & model"
              status={mapLlmStatus(diagnostics.llm.status)}
              description="Allowed provider, model, and agent access for LLM usage."
            >
              <div className="space-y-2 text-sm">
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  Provider: {diagnostics.llm.provider} • Model: {diagnostics.llm.model}
                </p>
                <p className="text-xs text-zinc-700 dark:text-zinc-200">
                  Allowed agents: {diagnostics.llm.allowedAgents.join(", ")}
                </p>
                <p className="text-xs text-zinc-700 dark:text-zinc-200">
                  Caps: max tokens {diagnostics.llm.maxTokens ?? "—"}, verbosity cap {diagnostics.llm.verbosityCap ?? "—"}
                </p>
                {diagnostics.llm.reason ? (
                  <p className="text-xs text-amber-700">{diagnostics.llm.reason}</p>
                ) : diagnostics.llm.fireDrillOverride ? (
                  <p className="text-xs text-amber-700">Fire Drill overrides LLM calls until incidents resolve.</p>
                ) : (
                  <p className="text-xs text-zinc-700 dark:text-zinc-200">LLM usage is available for configured agents.</p>
                )}
              </div>
            </DiagnosticCard>

            <DiagnosticCard
              title="Audit logging"
              status={diagnostics.auditLogging.enabled ? "ok" : "warn"}
              description="Security event ingestion for sign-ins, roles, and plan changes."
            >
              <p>
                {diagnostics.auditLogging.enabled
                  ? `${diagnostics.auditLogging.eventsRecorded} events recorded.`
                  : "No audit events captured yet."}
              </p>
            </DiagnosticCard>

            <DiagnosticCard
              title="Data export"
              status={diagnostics.dataExport.enabled ? "ok" : "off"}
              description="ZIP bundle of candidates, jobs, matches, and logs."
            >
              <p>Exports are available to tenant admins from the Admin → Tenant data export page.</p>
            </DiagnosticCard>

            <DiagnosticCard
              title="Retention"
              status={diagnostics.retention.configured ? "ok" : "warn"}
              description="Retention and deletion posture for tenant data."
            >
              {diagnostics.retention.configured ? (
                <p>
                  {`Retention window: ${diagnostics.retention.days} days (${(diagnostics.retention.mode ?? "unspecified")
                    .toLowerCase()
                    .replace("_", " ")}).`}
                </p>
              ) : (
                <p>No retention policy has been configured yet.</p>
              )}
            </DiagnosticCard>

            <DiagnosticCard
              title="Subscription & plan limits"
              status={diagnostics.plan.id ? "ok" : "warn"}
              description="Active subscription, trial status, and limit overrides."
            >
              <div className="space-y-1">
                <p>Plan: {diagnostics.plan.name ?? "No active plan"}</p>
                <p>Trial: {diagnostics.plan.isTrial ? `Active until ${formatDate(diagnostics.plan.trialEndsAt)}` : "Not in trial"}</p>
                <p className="text-xs text-zinc-600">Limits payload: {JSON.stringify(diagnostics.plan.limits)}</p>
              </div>
            </DiagnosticCard>

            <DiagnosticCard
              title="Feature flags"
              status={diagnostics.featureFlags.enabled ? "ok" : "warn"}
              description="Runtime feature toggles enabled for this tenant."
            >
              {diagnostics.featureFlags.enabled ? (
                <p>{diagnostics.featureFlags.enabledFlags.join(", ")}</p>
              ) : (
                <p>No feature flags enabled.</p>
              )}
            </DiagnosticCard>

            <DiagnosticCard
              title="Rate limits"
              status="ok"
              description="Default and plan-based throttling for sensitive actions."
            >
              <ul className="space-y-1">
                {diagnostics.rateLimits.map((limit) => (
                  <li key={limit.action} className="flex justify-between text-xs">
                    <span className="font-medium uppercase text-zinc-700">{limit.action}</span>
                    <span className="text-zinc-600">
                      daily {limit.override?.dailyLimit ?? limit.default.dailyLimit} / burst {limit.override?.burstLimit ?? limit.default.burstLimit}
                    </span>
                  </li>
                ))}
              </ul>
            </DiagnosticCard>
          </section>

          {access.isGlobalAdmin ? (
            <section className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Debug</p>
                  <h2 className="text-lg font-semibold text-zinc-900">Admin context</h2>
                </div>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">Visible to admins</span>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-100">
                {JSON.stringify(
                  {
                    user: { id: user.id, email: user.email, role: user.role },
                    tenantId: requestedTenant,
                    currentTenantId: normalizedCurrentTenantId,
                    tenantRoles,
                  },
                  null,
                  2,
                )}
              </pre>
            </section>
          ) : null}
        </div>
      </TenantAdminShell>
    );
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      return (
        <main className="mx-auto max-w-4xl px-6 py-12">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
            <h1 className="text-xl font-semibold">Tenant not found</h1>
            <p className="mt-2 text-sm text-rose-800">We couldn't locate that tenant. Double-check the URL and try again.</p>
            <div className="mt-4">
              <Link href="/admin/tenants" className="text-sm font-medium text-rose-900 underline">
                Return to tenants
              </Link>
            </div>
          </div>
        </main>
      );
    }

    throw error;
  }
}

