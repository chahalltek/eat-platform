import { NextResponse } from "next/server";

import { computeMatchConfidence } from "@/lib/matching/confidence";
import { prisma } from "@/server/db";
import type { IdentityUser } from "@/lib/auth/identityProvider";
import { Prisma } from "@prisma/client";

export type ConfidenceAgentInput = {
  jobCandidateId: string;
  marketSignals?: Prisma.InputJsonValue | null;
};

export type ConfidenceAssessment = {
  jobCandidateId: string;
  jobId: string;
  candidateId: string;
  score: number;
  band: "HIGH" | "MEDIUM" | "LOW";
  reasons: string[];
  narrative: string;
  marketSignals?: Prisma.InputJsonValue | null;
};

const buildNarrative = (reasons: string[]) =>
  reasons.length ? reasons.join(" ") : "Confidence evaluated with no additional rationale.";

export async function runConfidenceAssessment({
  jobCandidateId,
  marketSignals,
  requestedBy,
}: ConfidenceAgentInput & { requestedBy?: IdentityUser }): Promise<ConfidenceAssessment> {
  const jobCandidate = await prisma.jobCandidate.findUnique({
    where: { id: jobCandidateId },
    include: {
      candidate: { include: { skills: true } },
      jobReq: { include: { skills: true } },
    },
  });

  if (!jobCandidate) {
    throw NextResponse.json({ error: "jobCandidateId not found" }, { status: 404 });
  }

  const confidence = computeMatchConfidence({
    candidate: jobCandidate.candidate,
    jobReq: jobCandidate.jobReq,
  });

  const assessment: ConfidenceAssessment = {
    jobCandidateId,
    jobId: jobCandidate.jobReqId,
    candidateId: jobCandidate.candidateId,
    score: confidence.score,
    band: confidence.category,
    reasons: confidence.reasons,
    narrative: buildNarrative(confidence.reasons),
    marketSignals: marketSignals ?? null,
  };

  await prisma.jobCandidate.update({
    where: { id: jobCandidateId },
    data: {
      confidenceScore: assessment.score,
      confidenceBand: assessment.band,
      confidenceReasons: assessment.reasons,
      confidenceNarrative: assessment.narrative,
      confidenceSignals: assessment.marketSignals ?? Prisma.JsonNull,
      confidenceUpdatedAt: new Date(),
    },
  });

  await prisma.jobCandidateHistory.create({
    data: {
      tenantId: jobCandidate.tenantId,
      jobCandidateId,
      action: "CONFIDENCE_UPDATED",
      changes: assessment,
      performedById: requestedBy?.id,
    },
  });

  return assessment;
}

export async function getConfidenceAssessment(jobCandidateId: string): Promise<ConfidenceAssessment | null> {
  const jobCandidate = await prisma.jobCandidate.findUnique({
    where: { id: jobCandidateId },
    select: {
      jobReqId: true,
      candidateId: true,
      confidenceScore: true,
      confidenceBand: true,
      confidenceReasons: true,
      confidenceNarrative: true,
      confidenceSignals: true,
    },
  });

  if (!jobCandidate || jobCandidate.confidenceScore === null || jobCandidate.confidenceBand === null) {
    return null;
  }

  return {
    jobCandidateId,
    jobId: jobCandidate.jobReqId,
    candidateId: jobCandidate.candidateId,
    score: jobCandidate.confidenceScore,
    band: jobCandidate.confidenceBand as ConfidenceAssessment["band"],
    reasons: (jobCandidate.confidenceReasons as string[] | null) ?? [],
    narrative: jobCandidate.confidenceNarrative ?? buildNarrative((jobCandidate.confidenceReasons as string[] | null) ?? []),
    marketSignals: (jobCandidate.confidenceSignals as Prisma.JsonValue | null) ?? null,
  };
}
