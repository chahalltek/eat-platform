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

  const existing = await db.jobCandidate.findFirst({
    where: { tenantId: resolvedTenantId, jobReqId, candidateId },
  });

  if (existing) {
    await db.jobCandidate.update({
      where: { id: existing.id },
      data: { lastMatchResultId: matchResultId },
    });

    return;
  }

  await db.jobCandidate.create({
    data: {
      jobReqId,
      candidateId,
      tenantId: resolvedTenantId,
      status: JobCandidateStatus.POTENTIAL,
      lastMatchResultId: matchResultId,
    },
  });
}
