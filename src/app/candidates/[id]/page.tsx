import Link from "next/link";

import { JobOpportunitiesTable, type JobOpportunityRow } from "../JobOpportunitiesTable";
import { prisma } from "@/server/db/prisma";
import { computeCandidateConfidenceScore } from "@/lib/candidates/confidenceScore";
import { getCurrentTenantId } from "@/lib/tenant";
import { BackToConsoleButton } from "@/components/BackToConsoleButton";

type AgentRunRow = {
  id: string;
  agentName: string;
  startedAt: Date;
  output: unknown;
};

function formatDate(date?: Date | null) {
  if (!date) return "—";
  return date.toLocaleString();
}

function formatYears(years?: number | null) {
  if (years == null) return "—";
  if (years === 1) return "1 year";
  return `${years} years`;
}

function formatSource(candidate: { sourceType: string | null; sourceTag: string | null }) {
  if (candidate.sourceType && candidate.sourceTag) {
    return `${candidate.sourceType} • ${candidate.sourceTag}`;
  }

  if (candidate.sourceType) return candidate.sourceType;
  if (candidate.sourceTag) return candidate.sourceTag;
  return "—";
}

async function findRelatedAgentRun(candidateId: string, tenantId: string) {
  const runs = await prisma.$queryRaw<AgentRunRow[]>`
    SELECT id, "agentName", "startedAt", output
    FROM "AgentRunLog"
    WHERE "tenantId" = ${tenantId} AND (input::text ILIKE ${`%${candidateId}%`} OR output::text ILIKE ${`%${candidateId}%`})
    ORDER BY "startedAt" DESC
    LIMIT 1
  `;

  return runs[0];
}

export default async function CandidateDetail({
  params,
}: {
  params: { id: string };
}) {
  const tenantId = await getCurrentTenantId();

  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: {
      skills: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          proficiency: true,
          yearsOfExperience: true,
        },
      },
      jobCandidates: {
        include: {
          jobReq: {
            include: {
              customer: {
                select: { name: true },
              },
            },
          },
          lastMatch: {
            select: {
              score: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const jobOpportunities: JobOpportunityRow[] = candidate?.jobCandidates.map((jobCandidate) => ({
    id: jobCandidate.id,
    jobReqId: jobCandidate.jobReqId,
    title: jobCandidate.jobReq.title,
    location: jobCandidate.jobReq.location,
    customerName: jobCandidate.jobReq.customer?.name ?? null,
    status: jobCandidate.status,
    matchScore: jobCandidate.lastMatch?.score ?? null,
  })) ?? [];

  if (!candidate) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-4 flex justify-end">
          <BackToConsoleButton />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Candidate</h1>
        <p className="mt-2 text-gray-600">No candidate found.</p>
        <div className="mt-4">
          <Link href="/candidates" className="text-blue-600 hover:text-blue-800">
            Back to candidates
          </Link>
        </div>
      </div>
    );
  }

  const agentRun = await findRelatedAgentRun(candidate.id, tenantId);
  const confidence = computeCandidateConfidenceScore({ candidate });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">{candidate.fullName}</h1>
          <p className="text-gray-600">ID: {candidate.id}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/candidates" className="text-blue-600 hover:text-blue-800">
            Back to list
          </Link>
          <BackToConsoleButton />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Title</div>
          <div className="text-lg font-medium text-gray-900">
            {candidate.currentTitle ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Location</div>
          <div className="text-lg font-medium text-gray-900">
            {candidate.location ?? "—"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Source</div>
          <div className="text-lg font-medium text-gray-900">
            {formatSource(candidate)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Confidence score</div>
          <div className="mt-1 flex items-center space-x-3">
            <div className="text-3xl font-semibold text-gray-900">{confidence.score}</div>
            <div className="h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full bg-green-500"
                style={{ width: `${confidence.score}%` }}
                aria-hidden
              />
            </div>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>{confidence.breakdown.resumeCompleteness.reason}</li>
            <li>{confidence.breakdown.skillCoverage.reason}</li>
            <li>{confidence.breakdown.agentAgreement.reason}</li>
            <li>{confidence.breakdown.unknownFields.reason}</li>
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Created</div>
          <div className="text-lg font-medium text-gray-900">
            {formatDate(candidate.createdAt)}
          </div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-xs uppercase tracking-wide text-gray-500">Summary</div>
          <div className="mt-1 whitespace-pre-line text-gray-800">
            {candidate.summary ?? "—"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Email</div>
          <div className="text-lg font-medium text-gray-900">{candidate.email ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Phone</div>
          <div className="text-lg font-medium text-gray-900">{candidate.phone ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Current company</div>
          <div className="text-lg font-medium text-gray-900">{candidate.currentCompany ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Seniority</div>
          <div className="text-lg font-medium text-gray-900">{candidate.seniorityLevel ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Total experience</div>
          <div className="text-lg font-medium text-gray-900">{formatYears(candidate.totalExperienceYears)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Status</div>
          <div className="text-lg font-medium text-gray-900">{candidate.status ?? "—"}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Scores & confidence</h2>
          <div className="mt-3 space-y-4">
            <div>
              <div className="text-sm text-gray-600">Overall confidence</div>
              <div className="mt-1 flex items-center space-x-3">
                <div className="text-3xl font-semibold text-gray-900">{confidence.score}</div>
                <div className="h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${confidence.score}%` }}
                    aria-hidden
                  />
                </div>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
                <li>{confidence.breakdown.resumeCompleteness.reason}</li>
                <li>{confidence.breakdown.skillCoverage.reason}</li>
                <li>{confidence.breakdown.agentAgreement.reason}</li>
                <li>{confidence.breakdown.unknownFields.reason}</li>
              </ul>
            </div>
            <div>
              <div className="text-sm text-gray-600">Parsing confidence</div>
              <div className="text-lg font-medium text-gray-900">{candidate.parsingConfidence ?? "—"}</div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Resume content</h2>
          <div className="mt-2 rounded-md bg-gray-50 p-3 text-sm text-gray-800">
            <pre className="whitespace-pre-wrap break-words">{candidate.rawResumeText ?? "No resume available."}</pre>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Parsed skills</h2>
        {candidate.skills.length === 0 ? (
          <p className="mt-2 text-gray-600">No skills recorded.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {candidate.skills.map((skill) => (
              <div key={skill.id} className="rounded-md border border-gray-100 bg-gray-50 p-4">
                <div className="text-sm font-medium text-gray-900">{skill.name}</div>
                <div className="mt-1 text-sm text-gray-700">
                  Proficiency: {skill.proficiency ?? "—"}
                </div>
                <div className="text-sm text-gray-700">
                  Experience: {formatYears(skill.yearsOfExperience)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Job Opportunities</h2>
          <Link href="/jobs" className="text-sm text-blue-600 hover:text-blue-800">
            View all jobs
          </Link>
        </div>
        <div className="mt-4">
          <JobOpportunitiesTable jobs={jobOpportunities} />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Agent output</h2>
            <p className="text-sm text-gray-700">
              {agentRun ? (
                <>
                  <span className="font-medium">{agentRun.agentName}</span> on {formatDate(agentRun.startedAt)}
                </>
              ) : (
                "No related agent run found."
              )}
            </p>
          </div>
          {agentRun && (
            <Link
              href={`/agents/runs/${agentRun.id}`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View Agent Run
            </Link>
          )}
        </div>
        <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm text-gray-800">
          {agentRun ? (
            <pre className="whitespace-pre-wrap break-words">{JSON.stringify(agentRun.output, null, 2)}</pre>
          ) : (
            <div className="text-gray-700">Agent output will appear here after a related run completes.</div>
          )}
        </div>
      </div>
    </div>
  );
}
