import { ArrowLeftIcon, ClockIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { format } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ETECard } from "@/components/ETECard";
import { getCurrentUser } from "@/lib/auth/user";
import { getDecisionArtifact } from "@/server/decision/decisionArtifacts";

export const dynamic = "force-dynamic";

export default async function DecisionDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();

  if (!user) return notFound();

  const decision = await getDecisionArtifact({ artifactId: params.id, tenantId: user.tenantId });
  if (!decision) return notFound();

  const createdAt = format(new Date(decision.createdAt), "PPP p");
  const payloadPreview = typeof decision.payload === "object" ? JSON.stringify(decision.payload, null, 2) : String(decision.payload);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-6 py-10">
      <Link
        href="/fulfillment/decisions"
        className="inline-flex w-fit items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800 dark:hover:bg-zinc-800"
      >
        <ArrowLeftIcon className="h-4 w-4" aria-hidden />
        Back to decisions
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
            decision.status === "DRAFT"
              ? "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-700/60"
              : "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-700/60"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
          {decision.status === "DRAFT" ? "Draft" : "Published"}
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
            Decision artifact
          </p>
          <h1 className="text-3xl font-semibold leading-tight text-zinc-900 dark:text-zinc-50">{decision.type}</h1>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ETECard className="gap-3 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-800 ring-1 ring-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-100 dark:ring-indigo-800/60">
              {decision.type}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 font-semibold text-zinc-800 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700">
              <ClockIcon className="h-4 w-4" aria-hidden />
              {createdAt}
            </span>
          </div>
          <dl className="grid gap-3 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                Job
              </dt>
              <dd className="font-semibold text-zinc-900 dark:text-zinc-100">{decision.jobId ?? "Not linked"}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                Candidate IDs
              </dt>
              <dd className="font-semibold text-zinc-900 dark:text-zinc-100">
                {decision.candidateIds.length ? decision.candidateIds.join(", ") : "None"}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                Author
              </dt>
              <dd className="inline-flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                <UserCircleIcon className="h-5 w-5 text-zinc-400 dark:text-zinc-500" aria-hidden />
                {decision.createdByUserId}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                Tenant
              </dt>
              <dd className="font-semibold capitalize text-zinc-900 dark:text-zinc-100">{decision.tenantId}</dd>
            </div>
          </dl>
        </ETECard>

        <ETECard className="gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Payload</p>
          <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs text-emerald-100 ring-1 ring-zinc-800">{payloadPreview}</pre>
        </ETECard>
      </div>
    </div>
  );
}
