import { JobCandidateStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function upsertJobCandidateForMatch(
  jobReqId: string,
  candidateId: string,
  matchResultId: string,
) {
  await prisma.jobCandidate.upsert({
    where: { jobReqId_candidateId: { jobReqId, candidateId } },
    update: { lastMatchResultId: matchResultId },
    create: {
      jobReqId,
      candidateId,
      status: JobCandidateStatus.POTENTIAL,
      lastMatchResultId: matchResultId,
    },
  });
}
