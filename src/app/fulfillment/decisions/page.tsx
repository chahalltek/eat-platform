<<<<<<< ours
import { ArchiveBoxIcon, SparklesIcon } from "@heroicons/react/24/outline";

import { ETECard } from "@/components/ETECard";
import { getCurrentUser } from "@/lib/auth/user";
import { listDecisionArtifacts } from "@/server/decision/decisionArtifacts";

import { DecisionTimeline } from "./DecisionTimeline";

export const dynamic = "force-dynamic";

export default async function FulfillmentDecisionsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 shadow-sm">
          <p className="text-sm font-semibold">Sign in required</p>
          <p className="text-sm text-amber-800">
            Decision memory is available to authenticated users. Please sign in to view fulfillment decisions.
          </p>
        </div>
      </div>
    );
  }

  const decisions = await listDecisionArtifacts({ tenantId: user.tenantId, userId: user.id });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-100">
          <ArchiveBoxIcon className="h-6 w-6" aria-hidden />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
            Decision memory
          </p>
          <h1 className="text-3xl font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
            Fulfillment decisions timeline
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Browse decision artifacts across your tenant, filter by status, and follow the audit trail for submissions,
            rejections, and recommendations.
          </p>
        </div>
      </div>

      <ETECard className="gap-3 border-dashed border-indigo-200 bg-indigo-50 dark:border-indigo-800/50 dark:bg-indigo-950/30">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-100 dark:bg-indigo-900 dark:text-indigo-100 dark:ring-indigo-800/50">
            <SparklesIcon className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-100">Decision artifacts</p>
            <p className="text-sm text-indigo-900/80 dark:text-indigo-200/80">
              Status, type, author, job and candidate references stay attached for auditability. Drafts remain visible to
              their creators while published decisions are visible across the tenant.
            </p>
          </div>
        </div>
      </ETECard>

      <DecisionTimeline decisions={decisions} />
    </div>
=======
export default function FulfillmentDecisionsPage() {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Fulfillment</p>
      <h1 className="text-2xl font-semibold text-slate-900">Decisions</h1>
      <p className="text-sm text-slate-600">Placeholder for fulfillment decision reviews and publishing.</p>
    </section>
>>>>>>> theirs
  );
}
