import Link from "next/link";

import { EteLogo } from "@/components/EteLogo";
import { ETEClientLayout } from "@/components/ETEClientLayout";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { canManageFeatureFlags } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { getTestPlanSectionsWithItems } from "@/lib/ete/testPlanRegistry";
import { listTestPlanStatuses } from "@/lib/ete/testPlanStatus";

import { TestPlanChecklist } from "./TestPlanChecklist";

export const dynamic = "force-dynamic";

export default async function EatTestPlanPage() {
  const user = await getCurrentUser();

  if (!canManageFeatureFlags(user)) {
    return (
      <ETEClientLayout showFireDrillBanner={false}>
        <div className="mx-auto max-w-4xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Admins only</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need an admin role to view or update the EDGE Talent Engine™ test plan. Switch to an admin user to continue.
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

  const tenantId = user?.tenantId ?? DEFAULT_TENANT_ID;
  const statuses = await listTestPlanStatuses(tenantId);
  const sections = getTestPlanSectionsWithItems();

  const initialStatuses = Object.fromEntries(
    Object.entries(statuses).map(([itemId, status]) => [itemId, { ...status, updatedAt: status.updatedAt.toISOString() }]),
  );

  return (
    <ETEClientLayout showFireDrillBanner={false}>
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6 shadow-sm dark:border-indigo-900/60 dark:from-indigo-950/50 dark:via-zinc-950 dark:to-emerald-950/40">
          <div className="flex flex-col gap-3">
            <EteLogo variant="horizontal" />
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Admin</p>
              <h1 className="text-3xl font-semibold text-zinc-900 sm:text-4xl dark:text-zinc-50">
                EDGE Talent Engine™ – MVP Test Plan
              </h1>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                Interactive checklist for validating the EDGE Talent Engine™ MVP before release.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href="/admin/feature-flags"
              className="inline-flex items-center justify-center rounded-full border border-indigo-200 bg-white px-4 py-2 font-semibold text-indigo-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-50 hover:text-indigo-900 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-100 dark:hover:bg-indigo-800/40"
            >
              Back to System controls
            </Link>
            <Link
              href="/admin/tenant"
              className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-500"
            >
              Tenant directory
            </Link>
          </div>
        </header>

        <TestPlanChecklist sections={sections} initialStatuses={initialStatuses} />
      </div>
    </ETEClientLayout>
  );
}
