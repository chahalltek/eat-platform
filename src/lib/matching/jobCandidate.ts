import { JobCandidateStatus, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";

export async function upsertJobCandidateForMatch(
  jobReqId: string,
  candidateId: string,
  matchResultId: string,
  tenantId?: string,
  db: Prisma.TransactionClient | PrismaClient = prisma,
) {
  const resolvedTenantId = tenantId ?? (await getCurrentTenantId());

  await db.jobCandidate.upsert({
    where: { tenantId_jobReqId_candidateId: { tenantId: resolvedTenantId, jobReqId, candidateId } },
    update: { lastMatchResultId: matchResultId },
    create: {
      jobReqId,
      candidateId,
      tenantId: resolvedTenantId,
      status: JobCandidateStatus.POTENTIAL,
      lastMatchResultId: matchResultId,
    },
  });
}
