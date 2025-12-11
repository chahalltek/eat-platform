import type { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";

export type SetShortlistStateInput = {
  matchId: string;
  shortlisted: boolean;
  reason?: string | null;
};

export type SetShortlistStateResult = {
  id: string;
  shortlisted: boolean;
  shortlistReason: string | null;
  candidateId: string;
  jobReqId: string;
};

export async function setShortlistState(
  { matchId, shortlisted, reason }: SetShortlistStateInput,
  req?: NextRequest,
): Promise<SetShortlistStateResult> {
  const user = await getCurrentUser(req);

  if (!user) {
    throw new Error("Unauthorized");
  }

  const existingMatch = await prisma.matchResult.findUnique({
    where: { id: matchId },
    select: { id: true, tenantId: true },
  });

  if (!existingMatch) {
    throw new Error("Match not found");
  }

  if (user.tenantId && existingMatch.tenantId !== user.tenantId) {
    throw new Error("Forbidden");
  }

  const normalizedReason = reason?.toString().trim() ?? null;

  const updated = await prisma.matchResult.update({
    where: { id: matchId },
    data: {
      shortlisted,
      shortlistReason: normalizedReason,
    },
    select: {
      id: true,
      shortlisted: true,
      shortlistReason: true,
      candidateId: true,
      jobReqId: true,
    },
  });

  return {
    id: updated.id,
    shortlisted: updated.shortlisted,
    shortlistReason: updated.shortlistReason,
    candidateId: updated.candidateId,
    jobReqId: updated.jobReqId,
  } satisfies SetShortlistStateResult;
}
