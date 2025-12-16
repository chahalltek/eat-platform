import Link from "next/link";
import { headers } from "next/headers";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId, getTenantFromParamsOrSession } from "@/lib/tenant";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";
import { loadTenantConfig } from "@/lib/guardrails/tenantConfig";

import { AdminAccessDebugCard } from "./AdminAccessDebugCard";
import { GuardrailsPreviewPanel } from "./GuardrailsPreviewPanel";
import { OptimizationSuggestionsPanel } from "./OptimizationSuggestionsPanel";
import { TenantAdminShell } from "../TenantAdminShell";

export const dynamic = "force-dynamic";

function AccessDenied({ tenantId, debugEnabled }: { tenantId: string; debugEnabled: boolean }) {
  return (
    <ETEClientLayout>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need to be a tenant admin for this workspace to adjust guardrails presets.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium text-amber-900 underline">
              Return to home
            </Link>
          </div>
        </div>
        <div className="mt-6">
          <AdminAccessDebugCard tenantId={tenantId} enabled={debugEnabled} />
        </div>
      </main>
    </ETEClientLayout>
  );
}

export default async function GuardrailsPage({ params }: { params: { tenantId?: string } }) {
  const user = await getCurrentUser();
  const tenantId = params.tenantId?.trim?.() ?? "";
  const headerRole = getTenantRoleFromHeaders(await headers());
  const isTestEnv = process.env.NODE_ENV === "test";
  const baseDebugEnabled = process.env.NODE_ENV !== "production";
  const deniedDebugEnabled = !isTestEnv && baseDebugEnabled;

  if (!user) {
    return <AccessDenied tenantId={tenantId} debugEnabled={deniedDebugEnabled} />;
  }

  const currentTenantId = await getCurrentTenantId();
  const normalizedTenantId = getTenantFromParamsOrSession(tenantId, currentTenantId);
  const access = await resolveTenantAdminAccess(user, normalizedTenantId, { roleHint: headerRole });
  const debugEnabled = !isTestEnv && (baseDebugEnabled || access.isGlobalAdmin);
  const isGlobalWithoutMembership = access.isGlobalAdmin && !access.membership;
  const bootstrapTenantId =
    access.isGlobalAdmin && normalizedTenantId === DEFAULT_TENANT_ID ? normalizedTenantId : null;

  if (!access.hasAccess && !access.isGlobalAdmin) {
    return <AccessDenied tenantId={normalizedTenantId} debugEnabled={debugEnabled} />;
  }

  const guardrailsConfig = await loadTenantConfig(normalizedTenantId);

  return (
    <TenantAdminShell tenantId={normalizedTenantId} bootstrapTenantId={bootstrapTenantId}>
      <div data-testid="guardrails-presets-page" className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin</p>
            <h1 className="text-3xl font-semibold text-zinc-900">Guardrails presets</h1>
            <p className="text-sm text-zinc-600">
              Preview how shortlist guardrails behave before saving changes for tenant
              <span className="font-semibold"> {normalizedTenantId}</span>.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
          >
            Back to home
          </Link>
        </header>

        {isGlobalWithoutMembership ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Limited membership context</p>
            <p>You are accessing this tenant as a global admin without explicit tenant membership.</p>
          </div>
        ) : null}

        {guardrailsConfig.schemaMismatch ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">TenantConfig schema mismatch, migration pending.</p>
            <p className="text-xs text-amber-800">
              Guardrails are using safe defaults until the database schema is migrated.
            </p>
          </div>
        ) : null}

        {debugEnabled ? <AdminAccessDebugCard tenantId={normalizedTenantId} enabled={debugEnabled} /> : null}

        <OptimizationSuggestionsPanel tenantId={normalizedTenantId} />
        <GuardrailsPreviewPanel tenantId={normalizedTenantId} />
      </div>
    </TenantAdminShell>
  );
}
