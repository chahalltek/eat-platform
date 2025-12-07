import { computeMatchScore } from "@/lib/matching/msa";
import { prisma } from "@/lib/prisma";

export async function matchJobToAllCandidates(jobReqId: string, limit = 200) {
  const jobReq = await prisma.jobReq.findUnique({
    where: { id: jobReqId },
    include: { skills: true },
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

  const existingResults = await prisma.matchResult.findMany({
    where: {
      jobReqId,
      candidateId: { in: candidates.map((candidate) => candidate.id) },
    },
  });

  const existingByCandidateId = new Map(
    existingResults.map((result) => [result.candidateId, result]),
  );

  const matchResults = await Promise.all(
    candidates.map(async (candidate) => {
      const matchScore = computeMatchScore({ candidate, jobReq });
      const data = {
        candidateId: candidate.id,
        jobReqId,
        score: matchScore.score,
        reasons: matchScore.reasons,
        skillScore: matchScore.skillScore,
        seniorityScore: matchScore.seniorityScore,
        locationScore: matchScore.locationScore,
      };

      const existing = existingByCandidateId.get(candidate.id);
      if (existing) {
        return prisma.matchResult.update({
          where: { id: existing.id },
          data,
        });
      }

      return prisma.matchResult.create({ data });
    }),
  );

  return matchResults.sort((a, b) => b.score - a.score);
}
