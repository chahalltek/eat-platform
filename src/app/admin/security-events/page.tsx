import Link from "next/link";

import { listSecurityEvents } from "@/lib/audit/securityEvents";
import { canViewAuditLogs } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";

import { SecurityEventsTable } from "./SecurityEventsTable";

export const dynamic = "force-dynamic";

export default async function SecurityEventsPage() {
  const user = await getCurrentUser();
  const tenantId = user?.tenantId ?? undefined;

  if (!canViewAuditLogs(user, tenantId)) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Audit privileges required</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need audit log access to view security events. Switch to an authorized user to continue.
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

  const events = await listSecurityEvents(100, tenantId);

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin</p>
            <h1 className="text-3xl font-semibold text-gray-900">Security events</h1>
            <p className="text-sm text-gray-600">
              Enterprise-grade audit log for authentication changes, permissions, plan updates, and data exports.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
          >
            Back to home
          </Link>
        </header>

        <SecurityEventsTable
          events={events.map((event) => ({
            ...event,
            createdAt: event.createdAt.toISOString(),
          }))}
        />
      </div>
    </main>
  );
}
