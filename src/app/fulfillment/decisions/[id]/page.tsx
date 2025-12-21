<<<<<<< ours
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackToConsoleButton } from "@/components/BackToConsoleButton";
import { CodePill } from "@/components/CodePill";
import { CopyButton } from "@/components/CopyButton";
import { MonoText } from "@/components/MonoText";
import { normalizeRole, USER_ROLES } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";
import { getDecisionReceiptById } from "@/server/decision/decisionReceipts";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return date.toLocaleString();
}

function formatDecisionLabel(decisionType: string) {
  const labels: Record<string, string> = {
    RECOMMEND: "Recommendation",
    SUBMIT: "Submission",
    REJECT: "Rejection",
    PASS: "Pass/Defer",
  };

  return labels[decisionType] ?? decisionType;
}

function formatStatus(receipt: Awaited<ReturnType<typeof getDecisionReceiptById>>) {
  if (!receipt) return "Unknown";
  if (receipt.audit.chainValid) return "Chain intact";
  return "Chain warning";
}

export default async function DecisionReceiptPage({ params }: { params: { id: string } }) {
  const [tenantId, user] = await Promise.all([getCurrentTenantId(), getCurrentUser()]);
  const normalizedRole = normalizeRole(user?.role);
  const recruiterRoles = new Set([
    USER_ROLES.ADMIN,
    USER_ROLES.SYSTEM_ADMIN,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.RECRUITER,
    USER_ROLES.SOURCER,
    USER_ROLES.SALES,
  ]);

  if (!normalizedRole || !recruiterRoles.has(normalizedRole)) {
    notFound();
  }

  const receipt = await getDecisionReceiptById({ id: params.id, tenantId });

  if (!receipt) {
    notFound();
  }

  const prettyJson = JSON.stringify(
    {
      id: receipt.id,
      jobId: receipt.jobId,
      candidateId: receipt.candidateId,
      candidateName: receipt.candidateName,
      decisionType: receipt.decisionType,
      summary: receipt.summary,
      drivers: receipt.drivers,
      risks: receipt.risks,
      tradeoff: receipt.tradeoff,
      confidenceScore: receipt.confidenceScore,
      recommendation: receipt.recommendation,
      bullhornTarget: receipt.bullhornTarget,
      standardizedTradeoff: receipt.standardizedTradeoff,
      standardizedRisks: receipt.standardizedRisks,
      governance: receipt.governance,
      audit: receipt.audit,
      archetype: receipt.archetype,
      createdAt: receipt.createdAt,
      createdBy: receipt.createdBy,
    },
    null,
    2,
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Decision Receipt</p>
            <h1 className="text-3xl font-semibold text-gray-900">{receipt.candidateName}</h1>
            <p className="mt-1 text-sm text-slate-600">Why we chose what we chose.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/jobs/${receipt.jobId}`}
              className="inline-flex items-center justify-center rounded-full border border-indigo-100 bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50"
            >
              View job
            </Link>
            <BackToConsoleButton />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-indigo-100 bg-white/80 p-6 shadow-sm sm:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">Decision type</div>
            <CodePill className="text-indigo-800 bg-indigo-50 ring-1 ring-indigo-100">
              {formatDecisionLabel(receipt.decisionType)}
            </CodePill>
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">Chain status</div>
            <CodePill className={receipt.audit.chainValid ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200" : "bg-amber-100 text-amber-900 ring-1 ring-amber-200"}>
              {formatStatus(receipt)}
            </CodePill>
          </div>
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-slate-500">Recorded by</div>
            <p className="text-sm font-medium text-slate-900">
              {receipt.createdBy.name ?? receipt.createdBy.email ?? "Unknown"}
            </p>
            <p className="text-xs text-slate-600">User ID: {receipt.createdBy.id}</p>
          </div>
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-slate-500">Created</div>
            <p className="text-sm font-medium text-slate-900">{formatDate(receipt.createdAt)}</p>
            <p className="text-xs text-slate-600">Decision ID: {receipt.id}</p>
          </div>
          <div className="sm:col-span-2 space-y-1">
            <div className="text-xs uppercase tracking-wide text-slate-500">Summary</div>
            <p className="whitespace-pre-line text-slate-800">{receipt.summary}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-900 text-slate-50 shadow-inner">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Decision payload</p>
              <p className="text-sm text-slate-200">Readable JSON for audits and troubleshooting.</p>
            </div>
            <CopyButton text={prettyJson} label="Copy JSON" className="!border-slate-700 !bg-slate-800 !text-slate-100 hover:!border-slate-500 hover:!bg-slate-700" />
          </div>
          <div className="overflow-x-auto px-4 py-4">
            <MonoText as="pre" className="text-sm text-emerald-100">
              {prettyJson}
            </MonoText>
          </div>
        </div>
=======
import { ArrowLeftIcon, ClockIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { format } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ETECard } from "@/components/ETECard";
import { getCurrentUser } from "@/lib/auth/user";
import { getDecisionArtifact, type DecisionArtifactStatus } from "@/server/decision/decisionArtifacts";

function StatusBadge({ status }: { status: DecisionArtifactStatus }) {
  const styles =
    status === "draft"
      ? "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-700/60"
      : "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-700/60";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${styles}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
      {status === "draft" ? "Draft" : "Published"}
    </span>
  );
}

export const dynamic = "force-dynamic";

export default async function DecisionDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();

  if (!user) return notFound();

  const decision = await getDecisionArtifact(params.id, { tenantId: user.tenantId, userId: user.id });
  if (!decision) return notFound();

  const author =
    decision.createdBy.name ??
    decision.createdBy.email ??
    (decision.createdBy.id ? `User ${decision.createdBy.id}` : "Unknown author");

  const createdAt = format(new Date(decision.createdAt), "PPP p");

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
        <StatusBadge status={decision.status} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
            Decision memory
          </p>
          <h1 className="text-3xl font-semibold leading-tight text-zinc-900 dark:text-zinc-50">{decision.summary}</h1>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ETECard className="gap-3 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-800 ring-1 ring-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-100 dark:ring-indigo-800/60">
              {decision.decisionType}
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
              <dd className="font-semibold text-zinc-900 dark:text-zinc-100">
                {decision.jobTitle ? `${decision.jobTitle} (${decision.jobId})` : decision.jobId}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                Candidate
              </dt>
              <dd className="font-semibold text-zinc-900 dark:text-zinc-100">
                {decision.candidateName} ({decision.candidateId})
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                Author
              </dt>
              <dd className="inline-flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                <UserCircleIcon className="h-5 w-5 text-zinc-400 dark:text-zinc-500" aria-hidden />
                {author}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                Visibility
              </dt>
              <dd className="font-semibold capitalize text-zinc-900 dark:text-zinc-100">
                {decision.visibility === "creator" ? "Creator only draft" : "Tenant-wide"}
              </dd>
            </div>
          </dl>
        </ETECard>

        <ETECard className="gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Decision signals</h2>
          <div className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            {decision.tradeoff ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  Tradeoff
                </p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{decision.tradeoff}</p>
                {decision.standardizedTradeoff ? (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">Standardized: {decision.standardizedTradeoff}</p>
                ) : null}
              </div>
            ) : null}

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                Drivers
              </p>
              {decision.drivers.length ? (
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {decision.drivers.map((driver) => (
                    <li key={driver} className="font-medium text-zinc-900 dark:text-zinc-100">
                      {driver}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-zinc-600 dark:text-zinc-400">No drivers captured.</p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                Risks
              </p>
              {decision.risks.length ? (
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {decision.risks.map((risk) => (
                    <li key={risk} className="font-medium text-zinc-900 dark:text-zinc-100">
                      {risk}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-zinc-600 dark:text-zinc-400">No risks captured.</p>
              )}
              {decision.standardizedRisks.length ? (
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Standardized: {decision.standardizedRisks.join(", ")}
                </p>
              ) : null}
            </div>
          </div>
        </ETECard>
>>>>>>> theirs
      </div>
    </div>
  );
}
