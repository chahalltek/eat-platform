import Link from "next/link";

import { JobCandidateStatus } from "@prisma/client";
import { OutreachGenerator } from "./OutreachGenerator";
import { prisma } from "@/lib/prisma";
import { JobCandidateStatusControl } from "./JobCandidateStatusControl";

function formatScore(score?: number | null) {
  if (score == null) return "—";
  return score.toLocaleString();
}

export default async function JobMatchesPage({
  params,
}: {
  params: { id: string };
}) {
  const job = await prisma.jobReq
    .findUnique({
      where: { id: params.id },
      include: {
        customer: { select: { name: true } },
        matchResults: {
          include: {
            candidate: true,
          },
          orderBy: { score: "desc" },
        },
        jobCandidates: {
          select: {
            id: true,
            candidateId: true,
            status: true,
          },
        },
      },
    })
    .catch((error) => {
      console.error("Failed to load job matches", error);
      return null;
    });

  if (!job) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">Job Matches</h1>
        <p className="text-gray-700">No job requisition found.</p>
        <Link href="/jobs" className="text-blue-600 hover:text-blue-800">
          Back to jobs
        </Link>
      </div>
    );
  }

  const jobCandidateByCandidateId = new Map(
    job.jobCandidates.map((jobCandidate) => [jobCandidate.candidateId, jobCandidate]),
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Matches</h1>
          <p className="text-gray-700">
            {job.title} ({job.id})
          </p>
          <p className="text-sm text-gray-600">
            {job.customer?.name ? `${job.customer.name} • ` : ""}
            {job.location ?? "Unknown location"}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Link href={`/jobs/${job.id}`} className="text-blue-600 hover:text-blue-800">
            Back to job
          </Link>
          <Link href="/jobs" className="text-blue-600 hover:text-blue-800">
            Jobs list
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {job.matchResults.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-700">
            No matches found for this job yet.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm text-gray-800">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Candidate
                </th>
                <th scope="col" className="px-4 py-3">
                  Score
                </th>
                <th scope="col" className="px-4 py-3">
                  Skill
                </th>
                <th scope="col" className="px-4 py-3">
                  Seniority
                </th>
                <th scope="col" className="px-4 py-3">
                  Location
                </th>
                <th scope="col" className="px-4 py-3">
                  Outreach
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {job.matchResults.map((match) => {
                const jobCandidate = jobCandidateByCandidateId.get(match.candidateId);

                return (
                  <tr key={match.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div>{match.candidate.fullName ?? "Unknown"}</div>
                      <div className="text-xs font-normal text-gray-600">
                        {match.candidate.currentTitle ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-800">{formatScore(match.score)}</td>
                    <td className="px-4 py-3 text-gray-800">{formatScore(match.skillScore)}</td>
                    <td className="px-4 py-3 text-gray-800">{formatScore(match.seniorityScore)}</td>
                    <td className="px-4 py-3 text-gray-800">{formatScore(match.locationScore)}</td>
                    <td className="px-4 py-3 text-gray-600 space-y-2">
                      {jobCandidate ? (
                        <JobCandidateStatusControl
                          jobCandidateId={jobCandidate.id}
                          initialStatus={jobCandidate.status as JobCandidateStatus}
                        />
                      ) : (
                        <span className="text-xs text-gray-500">No job candidate record</span>
                      )}
                      <OutreachGenerator
                        candidateId={match.candidateId ?? match.candidate.id}
                        jobReqId={job.id}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
