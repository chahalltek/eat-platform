import Link from "next/link";

import { ETEClientLayout } from "@/components/ETEClientLayout";
import { ETECard } from "@/components/ETECard";
import { AdminCardTitle } from "@/components/admin/AdminCardTitle";
import { listUsersForTenant } from "@/lib/admin/users";
import { canManageRbac } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";

import { UserAccessPanel } from "./UserAccessPanel";

export const dynamic = "force-dynamic";

function AccessDenied() {
  return (
    <ETEClientLayout showFireDrillBanner={false}>
      <div className="mx-auto max-w-4xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-semibold">User access management required</h1>
        <p className="mt-2 text-sm text-amber-800">
          You need an admin role with RBAC permissions to manage user access. Switch to an authorized user to continue.
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

export default async function UserAccessPage() {
  const user = await getCurrentUser();
  const tenantId = await getCurrentTenantId();

  if (!canManageRbac(user, tenantId)) {
    return <AccessDenied />;
  }

  const users = await listUsersForTenant(tenantId);

  return (
    <ETEClientLayout showFireDrillBanner={false}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin</p>
            <h1 className="text-3xl font-semibold text-zinc-900">User access</h1>
            <p className="text-sm text-zinc-600">
              Add users, adjust roles, and manage tenant access for the current workspace.
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
          <div className="space-y-2">
            <AdminCardTitle className="text-lg" stabilizeHeight>
              Access overview
            </AdminCardTitle>
            <p className="text-sm text-zinc-600">
              Roles determine platform permissions. Tenant access is scoped to the current workspace.
            </p>
          </div>
        </ETECard>

        <UserAccessPanel
          tenantId={tenantId}
          initialUsers={users.map((entry) => ({
            ...entry,
            createdAt: entry.createdAt.toISOString(),
            updatedAt: entry.updatedAt.toISOString(),
          }))}
        />
      </div>
    </ETEClientLayout>
  );
}
