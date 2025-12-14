import Link from "next/link";

import { JobCandidateStatus } from "@/server/db";

import { JobMatchesTable, type MatchRow } from "./JobMatchesTable";
import { RunMatcherButton } from "./RunMatcherButton";
import { computeCandidateConfidenceScore } from "@/lib/candidates/confidenceScore";
import { categorizeConfidence } from "./confidence";
import { getJobPredictiveSignals } from "@/lib/metrics/eteInsights";
import { prisma } from "@/server/db";
import { type HiringOutcomeStatus } from "@/lib/hiringOutcomes";

export default async function JobMatchesPage({
  params,
}: {
  params: { jobId: string };
}) {
  const job = await prisma.jobReq
    .findUnique({
      where: { id: params.jobId },
      include: {
        customer: { select: { name: true } },
        matchResults: {
          include: {
            candidate: {
              include: { skills: { select: { id: true, name: true, proficiency: true, yearsOfExperience: true } } },
            },
          },
          orderBy: { score: "desc" },
        },
        jobCandidates: {
          select: {
            id: true,
            candidateId: true,
            status: true,
             notes: true,
          },
        },
        hiringOutcomes: {
          select: {
            candidateId: true,
            status: true,
            source: true,
          },
        },
        skills: true,
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

  const hiringOutcomeByCandidateId = new Map(
    job.hiringOutcomes.map((outcome) => [outcome.candidateId, outcome]),
  );

  const predictiveSignals = await getJobPredictiveSignals(job.id, job.tenantId);

  const matchRows: MatchRow[] = job.matchResults.map((match) => {
    const candidateId = match.candidateId ?? match.candidate.id;
    const jobCandidate = candidateId ? jobCandidateByCandidateId.get(candidateId) : undefined;
    const hiringOutcome = candidateId ? hiringOutcomeByCandidateId.get(candidateId) : undefined;
    const confidence = computeCandidateConfidenceScore({
      candidate: {
        ...match.candidate,
        skills: match.candidate.skills,
      },
    });
    const confidenceCategory = categorizeConfidence(confidence.score);
    const confidenceReasons = [
      confidence.breakdown.resumeCompleteness.reason,
      confidence.breakdown.skillCoverage.reason,
      confidence.breakdown.agentAgreement.reason,
      confidence.breakdown.unknownFields.reason,
    ];

    return {
      id: match.id,
      candidateId,
      jobId: job.id,
      jobTitle: job.title,
      candidateName: match.candidate.fullName ?? "Name not provided",
      candidateEmail: match.candidate.email,
      currentTitle: match.candidate.currentTitle ?? match.candidate.currentCompany ?? null,
      score: match.score,
      jobCandidateId: jobCandidate?.id,
      jobCandidateStatus: jobCandidate?.status,
      jobCandidateNotes: jobCandidate?.notes,
      hiringOutcomeStatus: hiringOutcome?.status as HiringOutcomeStatus | undefined,
      hiringOutcomeSource: hiringOutcome?.source,
      explanation: match.reasons,
      skillScore: match.skillScore,
      seniorityScore: match.seniorityScore,
      locationScore: match.locationScore,
      candidateSignalScore: match.candidateSignalScore,
      candidateSignalBreakdown: match.candidateSignalBreakdown as
        | MatchRow["candidateSignalBreakdown"]
        | undefined,
      category: jobCandidate?.status ?? "POTENTIAL",
      keySkills: (match.candidate.normalizedSkills ?? []).slice(0, 4),
      jobSkills: job.skills.map((skill) => skill.name),
      candidateLocation: match.candidate.location,
      confidenceScore: confidence.score,
      confidenceCategory: confidenceCategory ?? undefined,
      confidenceReasons,
      shortlisted: jobCandidate?.status === JobCandidateStatus.SHORTLISTED,
      shortlistReason: jobCandidate?.notes ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Matches</h1>
          <p className="text-gray-700">
            {job.title} ({job.id})
          </p>
          <p className="text-sm text-gray-600">
            {job.customer?.name ? `${job.customer.name} • ` : ""}
            {job.location ?? "Location not provided"}
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-3">
          <RunMatcherButton jobId={job.id} />
          <Link href={`/jobs/${job.id}`} className="text-blue-600 hover:text-blue-800">
            Back to job
          </Link>
          <Link href="/jobs" className="text-blue-600 hover:text-blue-800">
            Jobs list
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-indigo-900">
          <div className="text-xs font-semibold uppercase tracking-wide">Estimated time-to-fill</div>
          <div className="text-2xl font-semibold">
            {predictiveSignals.estimatedTimeToFillDays} days
          </div>
          <p className="text-xs">Estimate based on shortlist velocity and match volume.</p>
        </div>
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-amber-900">
          <div className="text-xs font-semibold uppercase tracking-wide">Skill scarcity index</div>
          <div className="text-2xl font-semibold">{predictiveSignals.skillScarcityIndex}/100</div>
          <p className="text-xs">Higher values indicate tighter talent supply (estimate).</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Job summary</h2>
          <p className="text-sm text-gray-700">Insights from the intake form.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 px-6 py-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Customer</div>
              <div className="text-sm font-medium text-gray-900">{job.customer?.name ?? "Customer not provided"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Employment Type</div>
              <div className="text-sm font-medium text-gray-900">{job.employmentType ?? "Not specified"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Seniority</div>
              <div className="text-sm font-medium text-gray-900">{job.seniorityLevel ?? "Not specified"}</div>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Must-have skills</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {job.skills.filter((skill) => skill.required).length === 0 ? (
                  <span className="text-sm text-gray-600">No must-haves recorded.</span>
                ) : (
                  job.skills
                    .filter((skill) => skill.required)
                    .map((skill) => (
                      <span
                        key={skill.id}
                        className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                      >
                        {skill.name}
                      </span>
                    ))
                )}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Nice-to-haves</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {job.skills.filter((skill) => !skill.required).length === 0 ? (
                  <span className="text-sm text-gray-600">No additional skills recorded.</span>
                ) : (
                  job.skills
                    .filter((skill) => !skill.required)
                    .map((skill) => (
                      <span
                        key={skill.id}
                        className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-800"
                      >
                        {skill.name}
                      </span>
                    ))
                )}
              </div>
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs uppercase tracking-wide text-gray-500">Role overview</div>
            <p className="mt-1 whitespace-pre-line text-sm text-gray-800">
              {job.rawDescription || "No intake summary available."}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <JobMatchesTable matches={matchRows} jobTitle={job.title} jobId={job.id} />
      </div>
    </div>
  );
}
