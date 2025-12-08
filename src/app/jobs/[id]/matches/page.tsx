import Link from "next/link";

import { JobMatchesTable, type MatchRow } from "./JobMatchesTable";
import { prisma } from "@/lib/prisma";

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

  const matchRows: MatchRow[] = job.matchResults.map((match) => {
    const candidateId = match.candidateId ?? match.candidate.id;
    const jobCandidate = candidateId ? jobCandidateByCandidateId.get(candidateId) : undefined;

    return {
      id: match.id,
      candidateId,
      jobId: job.id,
      candidateName: match.candidate.fullName ?? "Unknown",
      currentTitle: match.candidate.currentTitle ?? match.candidate.currentCompany ?? null,
      score: match.score,
      jobCandidateId: jobCandidate?.id,
      jobCandidateStatus: jobCandidate?.status,
      explanation: match.reasons,
      skillScore: match.skillScore,
      seniorityScore: match.seniorityScore,
      locationScore: match.locationScore,
      candidateSignalScore: match.candidateSignalScore,
      candidateSignalBreakdown: match.candidateSignalBreakdown as
        | MatchRow["candidateSignalBreakdown"]
        | undefined,
    };
  });

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
        <JobMatchesTable matches={matchRows} />
      </div>
    </div>
  );
}
