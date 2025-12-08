import { MatchResult } from "@prisma/client";

<<<<<<< ours
import { computeJobFreshnessScore } from "@/lib/matching/freshness";
=======
import { computeCandidateSignalScore } from "@/lib/matching/candidateSignals";
>>>>>>> theirs
import { computeMatchScore } from "@/lib/matching/msa";
import { upsertJobCandidateForMatch } from "@/lib/matching/jobCandidate";
import { prisma } from "@/lib/prisma";

export async function matchJobToAllCandidates(jobReqId: string, limit = 200) {
  const jobReq = await prisma.jobReq.findUnique({
    where: { id: jobReqId },
    include: {
      skills: true,
      matchResults: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!jobReq) {
    throw new Error(`JobReq not found: ${jobReqId}`);
  }

  const candidates = await prisma.candidate.findMany({
    include: { skills: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  if (candidates.length === 0) {
    return [];
  }

  const jobCandidates = await prisma.jobCandidate.findMany({
    where: {
      jobReqId,
      candidateId: { in: candidates.map((candidate) => candidate.id) },
    },
  });

  const outreachInteractions = await prisma.outreachInteraction.groupBy({
    by: ["candidateId"],
    where: { jobReqId, candidateId: { in: candidates.map((candidate) => candidate.id) } },
    _count: { _all: true },
  });

  const jobCandidateById = new Map(
    jobCandidates.map((jobCandidate) => [jobCandidate.candidateId, jobCandidate]),
  );

  const outreachByCandidateId = new Map(
    outreachInteractions.map((interaction) => [interaction.candidateId, interaction._count._all]),
  );

  const existingResults = await prisma.matchResult.findMany({
    where: {
      jobReqId,
      candidateId: { in: candidates.map((candidate) => candidate.id) },
    },
  });

  const existingByCandidateId = new Map(
    existingResults.map((result) => [result.candidateId, result]),
  );

  const matchResults: MatchResult[] = [];

  const latestMatchActivity = jobReq.matchResults[0]?.createdAt ?? null;
  const jobFreshness = computeJobFreshnessScore({
    createdAt: jobReq.createdAt,
    updatedAt: jobReq.updatedAt,
    latestMatchActivity,
  });

  for (const candidate of candidates) {
<<<<<<< ours
    const matchScore = computeMatchScore({ candidate, jobReq }, { jobFreshnessScore: jobFreshness.score });
=======
    const candidateSignals = computeCandidateSignalScore({
      candidate,
      jobCandidate: jobCandidateById.get(candidate.id),
      outreachInteractions: outreachByCandidateId.get(candidate.id) ?? 0,
    });

    const matchScore = computeMatchScore({ candidate, jobReq }, candidateSignals);
>>>>>>> theirs
    const data = {
      candidateId: candidate.id,
      jobReqId,
      score: matchScore.score,
      reasons: matchScore.reasons,
      skillScore: matchScore.skillScore,
      seniorityScore: matchScore.seniorityScore,
      locationScore: matchScore.locationScore,
      candidateSignalScore: matchScore.candidateSignalScore,
      candidateSignalBreakdown: matchScore.candidateSignalBreakdown,
    };

    const existing = existingByCandidateId.get(candidate.id);

    const matchResult = await prisma.$transaction(async (tx) => {
      const savedResult = existing
        ? await tx.matchResult.update({
            where: { id: existing.id },
            data,
          })
        : await tx.matchResult.create({ data });

      await upsertJobCandidateForMatch(jobReqId, candidate.id, savedResult.id, tx);

      return savedResult;
    });

    matchResults.push(matchResult);
  }

  return matchResults.sort((a, b) => b.score - a.score);
}
