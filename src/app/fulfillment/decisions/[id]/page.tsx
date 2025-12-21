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
      </div>
    </div>
  );
}
