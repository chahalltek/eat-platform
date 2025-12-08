import { NextResponse } from "next/server";

import { computeCandidateSignalScore } from "@/lib/matching/candidateSignals";
import { computeJobFreshnessScore } from "@/lib/matching/freshness";
import { computeMatchScore } from "@/lib/matching/msa";
import { upsertJobCandidateForMatch } from "@/lib/matching/jobCandidate";
import { KILL_SWITCHES } from "@/lib/killSwitch";
import { enforceKillSwitch } from "@/lib/killSwitch/middleware";
import { prisma } from "@/lib/prisma";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { enforceFeatureFlag } from "@/lib/featureFlags/middleware";
import { getCurrentTenantId } from "@/lib/tenant";

export async function POST(req: Request) {
  const killSwitchResponse = enforceKillSwitch(KILL_SWITCHES.SCORERS, { componentName: "Scoring" });

  if (killSwitchResponse) {
    return killSwitchResponse;
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { jobReqId, candidateId } = (body ?? {}) as {
    jobReqId?: string;
    candidateId?: string;
  };

  const tenantId = await getCurrentTenantId();

  if (!jobReqId || !candidateId) {
    return NextResponse.json({ error: "jobReqId and candidateId are required" }, { status: 400 });
  }

  const flagCheck = await enforceFeatureFlag(FEATURE_FLAGS.SCORING, {
    featureName: "Scoring",
  });

  if (flagCheck) {
    return flagCheck;
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: { skills: true },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
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
    return NextResponse.json({ error: "JobReq not found" }, { status: 404 });
  }

  const jobCandidate = await prisma.jobCandidate.findUnique({
    where: { tenantId_jobReqId_candidateId: { tenantId, jobReqId, candidateId } },
  });

  const outreachInteractions = await prisma.outreachInteraction.count({
    where: { jobReqId, candidateId },
  });

  const candidateSignals = computeCandidateSignalScore({
    candidate,
    jobCandidate,
    outreachInteractions,
  });

  const latestMatchActivity = jobReq.matchResults[0]?.createdAt ?? null;
  const freshnessScore = computeJobFreshnessScore({
    createdAt: jobReq.createdAt,
    updatedAt: jobReq.updatedAt,
    latestMatchActivity,
  });

  const matchScore = computeMatchScore(
    { candidate, jobReq },
    { candidateSignals, jobFreshnessScore: freshnessScore.score },
  );

  const data = {
    candidateId,
    jobReqId,
    score: matchScore.score,
    reasons: matchScore.explanation,
    skillScore: matchScore.skillScore,
    seniorityScore: matchScore.seniorityScore,
    locationScore: matchScore.locationScore,
    candidateSignalScore: matchScore.candidateSignalScore,
    candidateSignalBreakdown: matchScore.candidateSignalBreakdown,
  };

  const existingMatch = await prisma.matchResult.findFirst({
    where: { candidateId, jobReqId },
  });

  const matchResult = existingMatch
    ? await prisma.matchResult.update({
        where: { id: existingMatch.id },
        data,
      })
    : await prisma.matchResult.create({ data });

  await upsertJobCandidateForMatch(jobReqId, candidateId, matchResult.id);

  return NextResponse.json(matchResult);
}
