import Link from "next/link";

import { getTenantAdminPageAccess } from "@/lib/tenant/tenantAdminPageAccess";

import { TenantAdminShell } from "../../TenantAdminShell";
import { RuntimeControlsDashboard } from "./RuntimeControlsDashboard";

export const dynamic = "force-dynamic";

function AccessDenied() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-semibold">Admin access required</h1>
        <p className="mt-2 text-sm text-amber-800">You need an admin role to adjust runtime controls.</p>
        <div className="mt-4">
          <Link href="/" className="text-sm font-medium text-amber-900 underline">
            Return to home
          </Link>
        </div>
      </div>
    </main>
  );
}

export default async function TenantRuntimeControlsPage({ params }: { params: { tenantId?: string } }) {
  const { tenantId = "", isAllowed, bootstrapTenantId } = await getTenantAdminPageAccess({
    tenantId: params.tenantId,
  });

  if (!isAllowed) {
    return <AccessDenied />;
  }

  return (
    <TenantAdminShell tenantId={tenantId} bootstrapTenantId={bootstrapTenantId}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Ops</p>
          <h1 className="text-3xl font-semibold text-zinc-900">Runtime controls</h1>
          <p className="text-sm text-zinc-600">
            Toggle execution paths, kill switches, and rollout protections for tenant {tenantId} in one place.
          </p>
        </header>

        <RuntimeControlsDashboard tenantId={tenantId} />
      </div>
    </TenantAdminShell>
  );
}
