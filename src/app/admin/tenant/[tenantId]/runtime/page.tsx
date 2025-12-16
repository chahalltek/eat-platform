import Link from "next/link";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import { ETECard } from "@/components/ETECard";
import { AdminCardTitle } from "@/components/admin/AdminCardTitle";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { canManageFeatureFlags, canManageTenants } from "@/lib/auth/permissions";
import { withTenantContext } from "@/lib/tenant";
import { getTenantMode } from "@/lib/tenantMode";
import { listFeatureFlags } from "@/lib/featureFlags";
import { getTenantAdminPageAccess } from "@/lib/tenant/tenantAdminPageAccess";
import { BootstrapAccessBanner } from "../BootstrapAccessBanner";
import { RuntimeModePanel } from "./RuntimeModePanel";
import { RuntimeFeatureFlagsPanel } from "./RuntimeFeatureFlagsPanel";

export const dynamic = "force-dynamic";

function buildSafetyContext() {
  const testsDisabled =
    process.env.TESTS_DISABLED_IN_THIS_ENVIRONMENT === "true" ||
    process.env.testsDisabledInThisEnvironment === "true";
  const hostingOnVercel =
    process.env.HOSTING_ON_VERCEL === "true" ||
    process.env["hosting-on-vercel"] === "true" ||
    process.env.VERCEL === "1";

  return {
    testsDisabled,
    hostingOnVercel,
    locked: testsDisabled || hostingOnVercel,
    reason: testsDisabled
      ? "Test and mutation APIs are disabled in this environment."
      : hostingOnVercel
        ? "Mutations are disabled while hosting on Vercel."
        : null,
  } as const;
}

export default async function TenantRuntimeControlsPage({ params }: { params: { tenantId?: string } }) {
  const { tenantId = "", access, isAllowed, user, bootstrapTenantId } = await getTenantAdminPageAccess({
    tenantId: params.tenantId,
  });
  const safety = buildSafetyContext();

  const [mode, flags] = await withTenantContext(tenantId, async () => {
    const [currentMode, currentFlags] = await Promise.all([
      getTenantMode(tenantId),
      listFeatureFlags(),
    ]);

    return [currentMode, currentFlags] as const;
  });

  const canEditMode = canManageTenants(user) && !safety.locked;
  const canEditFlags = canManageFeatureFlags(user) && !safety.locked;

  return (
    <ETEClientLayout>
      <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin</p>
              <h1 className="text-3xl font-semibold text-zinc-900">Runtime controls</h1>
              <p className="text-sm text-zinc-600">
                Adjust tenant runtime mode and feature flags without redeploying. Changes apply instantly for tenant
                <span className="font-semibold"> {tenantId}</span>.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
            >
              Back to home
            </Link>
          </header>

          {bootstrapTenantId ? <BootstrapAccessBanner tenantId={bootstrapTenantId} /> : null}

          {safety.locked ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Mutations disabled</p>
              <p>{safety.reason}</p>
            </div>
          ) : null}

          {!isAllowed ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Admin role required</p>
              <p>You can view runtime settings, but only tenant administrators can make changes.</p>
            </div>
          ) : null}

          <RuntimeModePanel
            tenantId={tenantId}
            mode={mode}
            canEdit={canEditMode && isAllowed}
            showRestrictedMessage={!canEditMode || !isAllowed}
            safetyReason={safety.locked ? safety.reason : null}
          />

          <ETECard className="gap-4 border-indigo-100 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <AdminCardTitle className="text-lg" stabilizeHeight>
                  Feature flags
                </AdminCardTitle>
                <p className="text-sm text-zinc-600">
                  Toggle platform capabilities for this tenant. Scoped changes only affect <span className="font-semibold">{tenantId}</span>.
                </p>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                Tenant runtime
              </span>
            </div>

            <RuntimeFeatureFlagsPanel
              tenantId={tenantId}
              initialFlags={flags.map((flag) => ({
                ...flag,
                updatedAt: flag.updatedAt.toISOString(),
              }))}
              canEdit={canEditFlags && isAllowed}
              showRestrictedMessage={!canEditFlags || !isAllowed}
              safetyReason={safety.locked ? safety.reason : null}
            />
          </ETECard>
        </div>
      </main>
    </ETEClientLayout>
  );
}
