import Link from "next/link";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import { ETECard } from "@/components/ETECard";
import { AdminCardTitle } from "@/components/admin/AdminCardTitle";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/user";
import { listFeatureFlags } from "@/lib/featureFlags";
import { canManageFeatureFlags } from "@/lib/auth/permissions";

import { FeatureFlagsPanel } from "./FeatureFlagsPanel";

export const dynamic = "force-dynamic";

export default async function FeatureFlagsPage() {
  const user = await getCurrentUser();

  if (!canManageFeatureFlags(user)) {
    return (
      <ETEClientLayout showFireDrillBanner={false}>
        <div className="mx-auto max-w-4xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need an admin role to manage feature flags. Switch to an admin user to continue.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium text-amber-900 underline">
              Back to Console
            </Link>
          </div>
        </div>
      </ETEClientLayout>
    );
  }

  const flags = await listFeatureFlags();
  const tenantId = user?.tenantId ?? DEFAULT_TENANT_ID;
  const diagnosticsPath = `/admin/tenant/${tenantId}/diagnostics`;

  return (
    <ETEClientLayout showFireDrillBanner={false}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin</p>
            <h1 className="text-3xl font-semibold text-zinc-900">Feature flag control</h1>
            <p className="text-sm text-zinc-600">
              Toggle access to agents, scoring, and UI blocks without redeploying the platform.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
          >
            Back to Console
          </Link>
        </header>

        <ETECard className="gap-4 border-indigo-100 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <AdminCardTitle className="text-lg" stabilizeHeight>
                Test Panel
              </AdminCardTitle>
              <p className="text-sm text-zinc-600">
                Run quick checks on ETE agents, data, and scoring for this tenant.
              </p>
            </div>

            <Link
              href={diagnosticsPath}
              className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500"
            >
              Open Test Panel
            </Link>
          </div>
        </ETECard>

        <ETECard className="gap-4 border-emerald-100 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <AdminCardTitle className="text-lg" stabilizeHeight>
                EDGE Talent Engine™ Test Plan
              </AdminCardTitle>
              <p className="text-sm text-zinc-600">
                Interactive checklist for validating the EDGE Talent Engine™ before release. Track charter items and detailed coverage.
              </p>
            </div>

            <Link
              href="/admin/ete/test-plan"
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-500"
            >
              Open MVP test plan
            </Link>
          </div>
        </ETECard>

        <FeatureFlagsPanel
          initialFlags={flags.map((flag) => ({
            ...flag,
            updatedAt: flag.updatedAt.toISOString(),
          }))}
        />
      </div>
    </ETEClientLayout>
  );
}
