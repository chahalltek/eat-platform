import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/user";
import { canManageTenants } from "@/lib/auth/permissions";
import { listTenantsWithPlans } from "@/lib/admin/tenants";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(value);
}

export function TenantsTable({
  tenants,
}: {
  tenants: Awaited<ReturnType<typeof listTenantsWithPlans>>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Tenant</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Plan</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Mode</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Created</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  <span className="block max-w-xs truncate" title={tenant.name}>
                    {tenant.name}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  <span className="block max-w-[12rem] truncate" title={tenant.plan?.name ?? "No plan"}>
                    {tenant.plan?.name ?? "No plan"}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      tenant.mode === "fire_drill"
                        ? "bg-amber-100 text-amber-800 ring-1 ring-amber-500/40"
                        : "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20"
                    }`}
                  >
                    {tenant.mode.replace("_", " ")}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      tenant.status === "active"
                        ? "bg-green-50 text-green-700 ring-1 ring-green-600/20"
                        : "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"
                    }`}
                  >
                    {tenant.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{formatDate(tenant.createdAt)}</td>
                <td className="px-6 py-4 text-right text-sm">
                  <Link href={`/admin/tenants/${tenant.id}`} className="font-semibold text-indigo-600 hover:text-indigo-800">
                    View details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function TenantsPage() {
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

  const tenants = await listTenantsWithPlans();

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin</p>
            <h1 className="text-3xl font-semibold text-zinc-900">Tenants & plans</h1>
            <p className="text-sm text-zinc-600">Review tenant accounts, plan assignments, and trial status.</p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
          >
            Back to Console
          </Link>
        </header>

        <TenantsTable tenants={tenants} />
      </div>
    </main>
  );
}
