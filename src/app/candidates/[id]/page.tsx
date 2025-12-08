import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { computeCandidateConfidenceScore } from "@/lib/candidates/confidenceScore";

type AgentRunRow = {
  id: string;
  agentName: string;
  startedAt: Date;
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

async function findRelatedAgentRun(candidateId: string) {
  const runs = await prisma.$queryRaw<AgentRunRow[]>`
    SELECT id, "agentName", "startedAt"
    FROM "AgentRunLog"
    WHERE input::text ILIKE ${`%${candidateId}%`} OR output::text ILIKE ${`%${candidateId}%`}
    ORDER BY "startedAt" DESC
    LIMIT 1
  `;

  return runs[0];
}

function formatScore(score?: number | null) {
  if (score == null) return "—";
  return score.toLocaleString();
}

export default async function CandidateDetail({
  params,
}: {
  params: { id: string };
}) {
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

  if (!candidate) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
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

  const agentRun = await findRelatedAgentRun(candidate.id);
  const confidence = computeCandidateConfidenceScore({ candidate });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">{candidate.fullName}</h1>
          <p className="text-gray-600">ID: {candidate.id}</p>
        </div>
        <Link href="/candidates" className="text-blue-600 hover:text-blue-800">
          Back to list
        </Link>
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
            <li>{confidence.breakdown.sourceQuality.reason}</li>
            <li>{confidence.breakdown.agentConsistency.reason}</li>
            <li>{confidence.breakdown.resumeCompleteness.reason}</li>
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

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Skills</h2>
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
        {candidate.jobCandidates.length === 0 ? (
          <p className="mt-2 text-gray-600">This candidate has not been linked to any jobs yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-md border border-gray-100">
            <table className="min-w-full divide-y divide-gray-200 text-sm text-gray-800">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Job
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Customer
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Match score
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Links
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {candidate.jobCandidates.map((jobCandidate) => (
                  <tr key={jobCandidate.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link
                        href={`/jobs/${jobCandidate.jobReqId}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {jobCandidate.jobReq.title}
                      </Link>
                      <div className="text-xs font-normal text-gray-600">
                        {jobCandidate.jobReq.location ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      {jobCandidate.jobReq.customer?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-800">{jobCandidate.status}</td>
                    <td className="px-4 py-3 text-gray-800">
                      {formatScore(jobCandidate.lastMatch?.score)}
                    </td>
                    <td className="px-4 py-3 text-sm text-blue-600">
                      <div className="flex flex-col space-y-1">
                        <Link href={`/jobs/${jobCandidate.jobReqId}`} className="hover:text-blue-800">
                          Job details
                        </Link>
                        <Link
                          href={`/jobs/${jobCandidate.jobReqId}/matches`}
                          className="hover:text-blue-800"
                        >
                          Matches
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {agentRun && (
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Related Agent Run</h2>
          <p className="mt-2 text-gray-700">
            <span className="font-medium">{agentRun.agentName}</span> on {formatDate(agentRun.startedAt)}
          </p>
          <Link
            href={`/agents/runs/${agentRun.id}`}
            className="mt-3 inline-block text-blue-600 hover:text-blue-800"
          >
            View Agent Run
          </Link>
        </div>
      )}
    </div>
  );
}
