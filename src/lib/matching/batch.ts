import { MatchResult } from "@prisma/client";

import { computeCandidateSignalScore } from "@/lib/matching/candidateSignals";
import { computeJobFreshnessScore } from "@/lib/matching/freshness";
import { computeMatchScore } from "@/lib/matching/msa";
import { upsertJobCandidateForMatch } from "@/lib/matching/jobCandidate";
import { FEATURE_FLAGS, isFeatureEnabled } from "@/lib/featureFlags";
import { assertKillSwitchDisarmed, KILL_SWITCHES } from "@/lib/killSwitch";
import { prisma } from "@/lib/prisma";
import { computeMatchConfidence } from "@/lib/matching/confidence";
import { loadTenantConfig } from "@/lib/config/tenantConfig";

export async function matchJobToAllCandidates(jobReqId: string, limit = 200) {
  assertKillSwitchDisarmed(KILL_SWITCHES.SCORERS, { componentName: "Scoring" });

  const scoringEnabled = await isFeatureEnabled(FEATURE_FLAGS.SCORING);

  if (!scoringEnabled) {
    throw new Error("Scoring is disabled");
  }

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
    where: { tenantId: jobReq.tenantId },
    include: { skills: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  if (candidates.length === 0) {
    return [];
  }

  const jobCandidates = await prisma.jobCandidate.findMany({
    where: {
      tenantId: jobReq.tenantId,
      jobReqId,
      candidateId: { in: candidates.map((candidate) => candidate.id) },
    },
  });

  const outreachInteractions = await prisma.outreachInteraction.groupBy({
    by: ["candidateId"],
    where: {
      tenantId: jobReq.tenantId,
      jobReqId,
      candidateId: { in: candidates.map((candidate) => candidate.id) },
    },
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
      tenantId: jobReq.tenantId,
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

  const tenantConfig = await loadTenantConfig(jobReq.tenantId);
  const matcherConfig = tenantConfig.scoring.matcher;
  const confidenceConfig = tenantConfig.scoring.confidence;
  const explainEnabled = tenantConfig.msa?.matcher?.explain !== false;

  for (const candidate of candidates) {
    const candidateSignals = computeCandidateSignalScore({
      candidate,
      jobCandidate: jobCandidateById.get(candidate.id),
      outreachInteractions: outreachByCandidateId.get(candidate.id) ?? 0,
    });

    const matchScore = computeMatchScore(
      { candidate, jobReq },
      {
        candidateSignals,
        jobFreshnessScore: jobFreshness.score,
        matcherConfig,
        explain: explainEnabled,
      },
    );

    const confidence = computeMatchConfidence({ candidate, jobReq }, confidenceConfig);
    const candidateSignalBreakdown = {
      ...(matchScore.candidateSignalBreakdown ?? {}),
      confidence,
    } as const;
    const data = {
      candidateId: candidate.id,
      jobReqId,
      score: matchScore.score,
      reasons: matchScore.explanation,
      skillScore: matchScore.skillScore,
      seniorityScore: matchScore.seniorityScore,
      locationScore: matchScore.locationScore,
      candidateSignalScore: matchScore.candidateSignalScore,
      candidateSignalBreakdown,
    };

    const existing = existingByCandidateId.get(candidate.id);

    const matchResult = await prisma.$transaction(async (tx) => {
      const savedResult = existing
        ? await tx.matchResult.update({
            where: { id: existing.id },
            data: { ...data, tenantId: jobReq.tenantId },
          })
        : await tx.matchResult.create({ data: { ...data, tenantId: jobReq.tenantId } });

      await upsertJobCandidateForMatch(jobReqId, candidate.id, savedResult.id, jobReq.tenantId, tx);

      return savedResult;
    });

    matchResults.push(matchResult);
  }

  return matchResults.sort((a, b) => b.score - a.score);
}
