import Link from "next/link";

import { FEATURE_FLAGS, isFeatureEnabled } from "@/lib/featureFlags";
import { getJobPredictiveSignals } from "@/lib/metrics/eteInsights";
import { prisma } from "@/server/db";
import { MatchRunner } from "./MatchRunner";
import { FreshnessIndicator } from "../FreshnessIndicator";

function formatDate(date?: Date | null) {
  if (!date) return "—";
  return date.toLocaleString();
}

function formatSalary(
  salaryMin?: number | null,
  salaryMax?: number | null,
  salaryCurrency?: string | null,
  salaryInterval?: string | null,
) {
  if (salaryMin == null && salaryMax == null) return "—";

  const currency = salaryCurrency ?? "";
  const interval = salaryInterval ? `/${salaryInterval}` : "";

  if (salaryMin != null && salaryMax != null) {
    return `${currency}${salaryMin.toLocaleString()} - ${currency}${salaryMax.toLocaleString()}${interval}`;
  }

  if (salaryMin != null) return `${currency}${salaryMin.toLocaleString()}${interval}`;
  return `${currency}${salaryMax?.toLocaleString() ?? ""}${interval}`;
}

function formatSource(job: { sourceType: string | null; sourceTag: string | null }) {
  if (job.sourceType && job.sourceTag) {
    return `${job.sourceType} • ${job.sourceTag}`;
  }

  if (job.sourceType) return job.sourceType;
  if (job.sourceTag) return job.sourceTag;
  return "—";
}

export default async function JobDetail({
  params,
}: {
  params: { jobId: string };
}) {
  const [uiBlocksEnabled, scoringEnabled] = await Promise.all([
    isFeatureEnabled(FEATURE_FLAGS.UI_BLOCKS),
    isFeatureEnabled(FEATURE_FLAGS.SCORING),
  ]);

  const job = await prisma.jobReq
      .findUnique({
        where: { id: params.jobId },
        include: {
          customer: { select: { name: true } },
          skills: {
            orderBy: [
            { required: "desc" },
            { name: "asc" },
          ],
          select: { id: true, name: true, required: true, weight: true },
        },
        matchResults: {
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    })
    .catch((error) => {
      console.error("Failed to load job requisition", error);
      return null;
    });

  if (!job) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-gray-900">Job Requisition</h1>
        <p className="mt-2 text-gray-600">No job requisition found.</p>
        <div className="mt-4">
          <Link href="/jobs" className="text-blue-600 hover:text-blue-800">
            Back to jobs
          </Link>
        </div>
      </div>
    );
  }

  const requiredSkills = job.skills.filter((skill) => skill.required);
  const niceToHaveSkills = job.skills.filter((skill) => !skill.required);
  const marketInsights = await getJobPredictiveSignals(job.id, job.tenantId);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">{job.title}</h1>
          <p className="text-gray-600">ID: {job.id}</p>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <FreshnessIndicator
            createdAt={job.createdAt}
            updatedAt={job.updatedAt}
            latestMatchActivity={job.matchResults[0]?.createdAt ?? null}
          />
          <Link
            href={`/jobs/${job.id}/matches`}
            className="text-blue-600 hover:text-blue-800"
          >
            View Matches
          </Link>
          <Link href="/jobs" className="text-blue-600 hover:text-blue-800">
            Back to list
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Customer</div>
          <div className="text-lg font-medium text-gray-900">
            {job.customer?.name ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Location</div>
          <div className="text-lg font-medium text-gray-900">
            {job.location ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Employment Type</div>
          <div className="text-lg font-medium text-gray-900">
            {job.employmentType ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Seniority Level</div>
          <div className="text-lg font-medium text-gray-900">
            {job.seniorityLevel ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Salary</div>
          <div className="text-lg font-medium text-gray-900">
            {formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryInterval)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Status</div>
          <div className="text-lg font-medium text-gray-900">
            {job.status ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Source</div>
          <div className="text-lg font-medium text-gray-900">{formatSource(job)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Created</div>
          <div className="text-lg font-medium text-gray-900">{formatDate(job.createdAt)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Updated</div>
          <div className="text-lg font-medium text-gray-900">{formatDate(job.updatedAt)}</div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-xs uppercase tracking-wide text-gray-500">Raw Description</div>
          <div className="mt-1 whitespace-pre-line text-gray-800">{job.rawDescription}</div>
        </div>
      </div>

      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Market Insights</p>
            <h2 className="text-xl font-semibold text-gray-900">Role outlook</h2>
            <p className="text-sm text-gray-700">Advisory signals only—no blocking checks.</p>
          </div>
          <Link
            href="/admin/guardrails"
            className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
          >
            Adjust Guardrails
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-indigo-100 bg-white/60 p-4 text-indigo-900">
            <div className="text-xs font-semibold uppercase tracking-wide">Difficulty</div>
            <div className="text-lg font-semibold">{marketInsights.difficultyLabel}</div>
            <p className="text-sm text-indigo-800">{marketInsights.difficultyReason}</p>
          </div>
          <div className="rounded-md border border-amber-100 bg-amber-50 p-4 text-amber-900">
            <div className="text-xs font-semibold uppercase tracking-wide">Scarcity</div>
            <div className="text-lg font-semibold">{marketInsights.skillScarcityIndex}/100</div>
            <p className="text-sm text-amber-800">{marketInsights.scarcityWarning}</p>
          </div>
          <div className="rounded-md border border-slate-100 bg-white/60 p-4 text-slate-900">
            <div className="text-xs font-semibold uppercase tracking-wide">Median time-to-fill</div>
            <div className="text-lg font-semibold">{marketInsights.timeToFillBandLabel}</div>
            <p className="text-sm text-slate-700">{marketInsights.timeToFillBandHint}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 rounded-md border border-indigo-100 bg-white/70 p-4 text-sm text-indigo-900 sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-indigo-500" aria-hidden />
            <p>
              This job is more restrictive than {marketInsights.restrictivenessPercentile}% of similar roles.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
            <p>
              Reducing must-haves could improve fill probability by ~{marketInsights.fillProbabilityLiftPercent}%.
            </p>
          </div>
        </div>
      </div>

      {uiBlocksEnabled ? (
        scoringEnabled ? (
          <MatchRunner jobReqId={job.id} />
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Scoring is turned off. Enable the Scoring flag to run matching against this role.
          </div>
        )
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          UI blocks are disabled. Enable the UI Blocks flag to access scoring tools.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Required Skills</h2>
          {requiredSkills.length === 0 ? (
            <p className="mt-2 text-gray-600">No required skills listed.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {requiredSkills.map((skill) => (
                <li key={skill.id} className="rounded-md border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-900">{skill.name}</div>
                  <div className="text-sm text-gray-700">
                    Importance: {skill.weight != null ? skill.weight : "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Nice-to-Have Skills</h2>
          {niceToHaveSkills.length === 0 ? (
            <p className="mt-2 text-gray-600">No nice-to-have skills listed.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {niceToHaveSkills.map((skill) => (
                <li key={skill.id} className="rounded-md border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-900">{skill.name}</div>
                  <div className="text-sm text-gray-700">
                    Importance: {skill.weight != null ? skill.weight : "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
