import Link from "next/link";
import { headers } from "next/headers";

import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";

import { TenantAdminShell } from "../../TenantAdminShell";

export const dynamic = "force-dynamic";

function AccessDenied() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-semibold">Admin access required</h1>
        <p className="mt-2 text-sm text-amber-800">
          You need to be a tenant admin for this workspace to open the ops test runner.
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

export default async function TenantTestRunnerPage({ params }: { params: { tenantId?: string } }) {
  const user = await getCurrentUser();
  const tenantId = params.tenantId?.trim?.() ?? "";
  const headerRole = getTenantRoleFromHeaders(await headers());
  const currentTenantId = await getCurrentTenantId();
  const targetTenantId = tenantId || currentTenantId || "";

  const access = await resolveTenantAdminAccess(user, targetTenantId, { roleHint: headerRole });

  if (!access.hasAccess) {
    return <AccessDenied />;
  }

  return (
    <TenantAdminShell tenantId={targetTenantId}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Ops</p>
          <h1 className="text-3xl font-semibold text-zinc-900">Test runner</h1>
          <p className="text-sm text-zinc-600">
            Validate ETE agent flows, data syncs, and guardrail behaviors for tenant {targetTenantId} without leaving the admin
            console.
          </p>
        </header>

        <section className="space-y-3 rounded-2xl border border-dashed border-indigo-200 bg-white/60 p-6 text-sm text-zinc-700">
          <p className="font-semibold text-zinc-900">Coming soon</p>
          <p>
            The ops test runner will let you execute predefined smoke tests (ATS ingestion, scoring, shortlist generation,
            messaging) and capture structured logs for troubleshooting.
          </p>
          <p className="text-xs text-zinc-500">Use Diagnostics and Guardrails while we finish wiring up the runner.</p>
        </section>
      </div>
    </TenantAdminShell>
  );
}
