import { JobCandidateStatus, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";

type ShortlistDbClient = Pick<PrismaClient, "candidateMatch" | "jobCandidate"> |
  Pick<Prisma.TransactionClient, "candidateMatch" | "jobCandidate">;

const STATUS_ORDER: JobCandidateStatus[] = [
  JobCandidateStatus.POTENTIAL,
  JobCandidateStatus.SHORTLISTED,
  JobCandidateStatus.SUBMITTED,
  JobCandidateStatus.INTERVIEWING,
  JobCandidateStatus.HIRED,
  JobCandidateStatus.REJECTED,
];

function rankForStatus(status: JobCandidateStatus) {
  return STATUS_ORDER.indexOf(status);
}

function resolvePipelineStatus(
  currentStatus: JobCandidateStatus | null,
  shortlisted: boolean,
) {
  if (shortlisted) {
    if (!currentStatus) return JobCandidateStatus.SHORTLISTED;

    const currentRank = rankForStatus(currentStatus);
    const shortlistedRank = rankForStatus(JobCandidateStatus.SHORTLISTED);

    return currentRank < shortlistedRank ? JobCandidateStatus.SHORTLISTED : null;
  }

  if (currentStatus === JobCandidateStatus.SHORTLISTED) {
    return JobCandidateStatus.POTENTIAL;
  }

  return null;
}

export async function setShortlistState(
  jobReqId: string,
  candidateId: string,
  shortlisted: boolean,
  shortlistReason?: string | null,
  options?: { tenantId?: string; db?: ShortlistDbClient },
) {
  const client = options?.db ?? prisma;
  const tenantId = options?.tenantId ?? (await getCurrentTenantId());
  const reason = shortlisted ? shortlistReason ?? null : null;

  await client.candidateMatch.updateMany({
    where: { jobId: jobReqId, candidateId },
    data: { shortlisted, shortlistReason: reason },
  });

  const existingJobCandidate = await client.jobCandidate.findFirst({
    where: { tenantId, jobReqId, candidateId },
  });

  const nextStatus = resolvePipelineStatus(existingJobCandidate?.status ?? null, shortlisted);

  if (existingJobCandidate) {
    if (nextStatus && nextStatus !== existingJobCandidate.status) {
      await client.jobCandidate.update({
        where: { id: existingJobCandidate.id },
        data: { status: nextStatus },
      });
    }

    return;
  }

  if (shortlisted) {
    await client.jobCandidate.create({
      data: {
        jobReqId,
        candidateId,
        tenantId,
        status: JobCandidateStatus.SHORTLISTED,
      },
    });
  }
}
