import Link from "next/link";

import { getFulfillmentJob } from "../data";
import { ETEClientLayout } from "@/components/ETEClientLayout";
import { canViewFulfillment } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

type JobDetailProps = {
  params: { jobId: string };
};

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm text-slate-800">{value ?? "—"}</p>
    </div>
  );
}

export default async function FulfillmentJobDetailPage({ params }: JobDetailProps) {
  const user = await getCurrentUser();

  if (!canViewFulfillment(user, user?.tenantId)) {
    return (
      <ETEClientLayout contentClassName="space-y-6">
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-red-900">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-red-800">You need fulfillment.view access to see this page.</p>
        </div>
      </ETEClientLayout>
    );
  }

  const job = await getFulfillmentJob(params.jobId);

  return (
    <ETEClientLayout contentClassName="space-y-8">
      <Link
        href="/fulfillment/jobs"
        className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-indigo-700"
      >
        <span aria-hidden>←</span>
        Back to jobs
      </Link>

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Fulfillment job</p>
          <h1 className="text-2xl font-semibold text-slate-900">{job.title}</h1>
          <p className="text-sm text-slate-600">Job ID: {job.id}</p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailRow label="Client" value={job.client} />
          <DetailRow label="Priority" value={job.priority} />
          <DetailRow label="Owner" value={job.owner} />
        </div>
      </article>
    </ETEClientLayout>
  );
}
