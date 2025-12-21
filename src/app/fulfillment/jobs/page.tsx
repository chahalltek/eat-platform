<<<<<<< ours
import Link from "next/link";

import { getFulfillmentJobs } from "./data";
import { FulfillmentJobsTable } from "./table/FulfillmentJobsTable";
import { ETEClientLayout } from "@/components/ETEClientLayout";
import { getCurrentUser } from "@/lib/auth/user";
import { canViewFulfillment } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

function AccessDenied() {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-red-900">
      <h1 className="text-xl font-semibold">Access denied</h1>
      <p className="mt-2 text-sm text-red-800">You need fulfillment.view access to see this page.</p>
    </div>
  );
}

export default async function FulfillmentJobsPage() {
  const user = await getCurrentUser();

  if (!canViewFulfillment(user)) {
    return (
      <ETEClientLayout contentClassName="space-y-6">
        <AccessDenied />
      </ETEClientLayout>
    );
  }

  const { jobs, source } = await getFulfillmentJobs();
  const showingSeededData = source === "seed";

  return (
    <ETEClientLayout contentClassName="space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          <span>Fulfillment</span>
          <span aria-hidden className="text-slate-400">/</span>
          <span>Jobs</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">Fulfillment Jobs</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Job-first workflow entry point for fulfillment. Track owners, priorities, and quickly jump into job details.
          </p>
        </div>
        {showingSeededData ? (
          <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            <span aria-hidden>⚠️</span>
            Showing seeded data until live fulfillment jobs are available.
          </p>
        ) : null}
      </header>

      <FulfillmentJobsTable jobs={jobs} />
    </ETEClientLayout>
=======
export default function FulfillmentJobsPage() {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Fulfillment</p>
      <h1 className="text-2xl font-semibold text-slate-900">Jobs</h1>
      <p className="text-sm text-slate-600">Placeholder for job fulfillment workflows.</p>
    </section>
>>>>>>> theirs
  );
}
