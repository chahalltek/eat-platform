import Link from "next/link";

import { TenantPlanEditor } from "./TenantPlanEditor";
import { TenantModeCard } from "./TenantModeCard";
import { getCurrentUser } from "@/lib/auth/user";
import { canManageTenants } from "@/lib/auth/permissions";
import { getTenantPlanDetail, NotFoundError, ValidationError } from "@/lib/admin/tenants";

export const dynamic = "force-dynamic";

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-red-800">{message}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/admin/tenants" className="text-sm font-medium text-red-900 underline">
            Back to tenants
          </Link>
          <Link href="/" className="text-sm font-medium text-red-900 underline">
            Back to Console
          </Link>
        </div>
      </div>
    </main>
  );
}

export default async function TenantDetailPage({ params }: { params: { tenantId: string } }) {
  const user = await getCurrentUser();

  if (!canManageTenants(user)) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need an admin role to manage tenants and plans. Switch to an admin user to continue.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium text-amber-900 underline">
              Back to Console
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const tenantId = params?.tenantId?.trim();

  if (!tenantId) {
    return <ErrorState title="Tenant id is required" message="Select a tenant to view plan and mode controls." />;
  }

  try {
    const detail = await getTenantPlanDetail(tenantId);

    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Tenant</p>
              <h1 className="text-3xl font-semibold text-zinc-900">{detail.tenant.name}</h1>
              <p className="text-sm text-zinc-600">Manage plan assignment and trial settings.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/tenant/${tenantId}/diagnostics`}
                className="inline-flex items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-white"
              >
                View diagnostics
              </Link>
              <Link
                href={`/admin/tenant/${tenantId}/operations-runbook`}
                className="inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 shadow-sm transition hover:border-amber-300 hover:bg-white"
              >
                Operations Runbook
              </Link>
              <Link
                href="/admin/tenants"
                className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
              >
                Back to list
              </Link>
            </div>
          </header>

          <TenantModeCard tenantId={detail.tenant.id} initialMode={detail.tenant.mode} />

          <TenantPlanEditor
            tenantId={detail.tenant.id}
            tenantName={detail.tenant.name}
            status={detail.tenant.status}
            mode={detail.tenant.mode}
            currentPlanId={detail.tenant.plan?.id ?? null}
            currentPlanName={detail.tenant.plan?.name ?? null}
            isTrial={detail.tenant.isTrial}
            trialEndsAt={detail.tenant.trialEndsAt ? detail.tenant.trialEndsAt.toISOString() : null}
            plans={detail.plans.map((plan) => ({ id: plan.id, name: plan.name }))}
          />
        </div>
      </main>
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return <ErrorState title="Invalid tenant id" message="Provide a tenant id to manage mode and plan settings." />;
    }

    if (error instanceof NotFoundError) {
      return <ErrorState title="Tenant not found" message="This tenant is not registered. Pick another tenant from the list." />;
    }

    throw error;
  }
}
