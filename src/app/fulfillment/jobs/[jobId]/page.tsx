<<<<<<< ours
import { JobDetailCockpit, type JobSummary } from "./JobDetailCockpit";

type PageParams = {
  params: { jobId: string };
  searchParams: Record<string, string | string[] | undefined>;
};

export default function FulfillmentJobPage({ params, searchParams }: PageParams) {
  const jobId = params.jobId;
  const from = typeof searchParams.from === "string" ? searchParams.from : undefined;
  const returnUrl = typeof searchParams.returnUrl === "string" ? searchParams.returnUrl : undefined;

  const jobSummary: JobSummary = {
    id: jobId,
    title: "Job detail cockpit",
    client: "Client to be assigned",
    priority: "Prioritization pending",
    owner: "Owner to be assigned",
  };

  return (
    <JobDetailCockpit
      job={jobSummary}
      returnUrl={returnUrl}
      showDeepLinkBanner={Boolean(from || returnUrl)}
      sourceSystem={from}
    />
=======
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

  if (!canViewFulfillment(user)) {
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

  if (!job) {
    return (
      <ETEClientLayout contentClassName="space-y-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-5 text-amber-900">
          <h1 className="text-xl font-semibold">Job not found</h1>
          <p className="mt-2 text-sm text-amber-800">We couldn&apos;t find that fulfillment job.</p>
          <div className="mt-4">
            <Link
              href="/fulfillment/jobs"
              className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
            >
              Return to jobs
            </Link>
          </div>
        </div>
      </ETEClientLayout>
    );
  }

  const summary = job.summary ?? "No description provided.";

  return (
    <ETEClientLayout contentClassName="space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          <Link href="/fulfillment/jobs" className="text-indigo-700 hover:text-indigo-900">
            Jobs
          </Link>
          <span aria-hidden className="text-slate-400">/</span>
          <span>Detail</span>
        </div>
        <h1 className="text-3xl font-semibold text-slate-900">{job.title}</h1>
        <p className="text-sm text-slate-600">Owned by {job.owner} • Last updated {new Date(job.updatedAt).toLocaleString()}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <DetailRow label="Client" value={job.client} />
        <DetailRow label="Priority" value={job.priority} />
        <DetailRow label="Status" value={job.status} />
        <DetailRow label="Needs Action" value={job.needsAction ? "Yes" : "No"} />
        <DetailRow label="Location" value={job.location ?? "—"} />
        <DetailRow label="Owner" value={job.owner} />
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Summary</h2>
        <p className="text-sm leading-relaxed text-slate-700">{summary}</p>
      </section>
    </ETEClientLayout>
>>>>>>> theirs
  );
}
