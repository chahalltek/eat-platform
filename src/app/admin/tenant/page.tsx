import Link from "next/link";

import { getTenantAdminPageAccess } from "@/lib/tenant/tenantAdminPageAccess";

import { TenantExportButton } from "./TenantExportButton";

export const dynamic = "force-dynamic";

export default async function TenantAdminPage() {
  const { tenantId, access, isAllowed, isGlobalWithoutMembership, bootstrapTenantId } =
    await getTenantAdminPageAccess();

  if (!isAllowed) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need to be a tenant admin for this workspace to export data.
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

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin</p>
            <h1 className="text-3xl font-semibold text-zinc-900">Tenant data export</h1>
            <p className="text-sm text-zinc-600">
              Download a structured snapshot of candidates, jobs, matches, and logs for this tenant.
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

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-zinc-900">Export tenant data</h2>
              <p className="text-sm text-zinc-600">
                Creates a zip bundle with NDJSON files for candidates, jobs, matches, and logs scoped to tenant
                <span className="font-semibold"> {tenantId}</span>.
              </p>
            </div>
            <TenantExportButton tenantId={tenantId} />
          </div>
        </section>
      </div>
    </main>
  );
}
