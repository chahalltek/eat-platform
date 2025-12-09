import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { Prisma } from "@prisma/client";

import { callLLM } from "@/lib/llm";
import { computeCandidateSignalScore } from "@/lib/matching/candidateSignals";
import { computeJobFreshnessScore } from "@/lib/matching/freshness";
import { computeMatchScore } from "@/lib/matching/msa";
import { upsertJobCandidateForMatch } from "@/lib/matching/jobCandidate";
import { prisma } from "@/lib/prisma";
import { createAgentRunLog } from "@/lib/agents/agentRunLog";
import { getCurrentUser, getUserTenantId } from "@/lib/auth/user";
import { agentFeatureGuard } from "@/lib/featureFlags/middleware";
import { AGENT_KILL_SWITCHES, enforceAgentKillSwitch } from "@/lib/agents/killSwitch";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { computeMatchConfidence } from "@/lib/matching/confidence";

const requestSchema = z.object({
  jobReqId: z.string().trim().min(1, "jobReqId is required"),
  candidateIds: z
    .array(z.string().trim().min(1))
    .optional()
    .refine((ids) => !ids || ids.length > 0, "candidateIds cannot be empty"),
  limit: z.number().int().positive().max(500).optional(),
});

async function buildMatchExplanation(
  jobTitle: string,
  jobDescription: string | null,
  candidateName: string,
  candidateSummary: string | null,
  deterministicBreakdown: Record<string, unknown>,
) {
  const systemPrompt =
    "You are a recruiting assistant. Given a job and candidate profile, explain why the candidate matches.";
  const userPrompt = `Job: ${jobTitle}\nDescription: ${jobDescription ?? "N/A"}\nCandidate: ${candidateName}\nSummary: ${candidateSummary ?? "N/A"}\nDeterministic scores: ${JSON.stringify(
    deterministicBreakdown,
  )}\nWrite a concise, bullet-point match rationale.`;

  try {
    return await callLLM({ systemPrompt, userPrompt });
  } catch (err) {
    console.warn("LLM explanation failed for match", err);
    return "LLM explanation unavailable";
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 },
    );
  }

  const { jobReqId, candidateIds, limit = 50 } = parsed.data;

  const currentUser = await getCurrentUser(req);

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const flagCheck = await agentFeatureGuard();

  if (flagCheck) {
    return flagCheck;
  }

  const killSwitchResponse = await enforceAgentKillSwitch(AGENT_KILL_SWITCHES.MATCHER);

  if (killSwitchResponse) {
    return killSwitchResponse;
  }

  const tenantId = (await getUserTenantId(req)) ?? currentUser.tenantId ?? DEFAULT_TENANT_ID;

  const jobReq = await prisma.jobReq.findUnique({
    where: { id: jobReqId, tenantId },
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

  const candidateWhere = candidateIds
    ? { id: { in: candidateIds }, tenantId }
    : { tenantId };

  const candidates = await prisma.candidate.findMany({
    where: candidateWhere,
    include: { skills: true },
    orderBy: { createdAt: "desc" },
    take: candidateIds ? undefined : limit,
  });

  if (candidates.length === 0) {
    return NextResponse.json({ matches: [], jobReqId, agentRunId: null }, { status: 200 });
  }

  const candidateIdList = candidates.map((candidate) => candidate.id);

  const [jobCandidates, outreachInteractions, existingMatchResults, existingMatches] =
    await Promise.all([
      prisma.jobCandidate.findMany({
        where: { tenantId, jobReqId, candidateId: { in: candidateIdList } },
      }),
      prisma.outreachInteraction.groupBy({
        by: ["candidateId"],
        where: { tenantId, jobReqId, candidateId: { in: candidateIdList } },
        _count: { _all: true },
      }),
      prisma.matchResult.findMany({
        where: { tenantId, jobReqId, candidateId: { in: candidateIdList } },
      }),
      prisma.match.findMany({
        where: { tenantId, jobReqId, candidateId: { in: candidateIdList } },
      }),
    ]);

  const jobCandidateById = new Map(jobCandidates.map((jc) => [jc.candidateId, jc]));
  const outreachByCandidateId = new Map(
    outreachInteractions.map((interaction) => [interaction.candidateId, interaction._count._all]),
  );
  const existingResultByCandidate = new Map(
    existingMatchResults.map((result) => [result.candidateId, result]),
  );
  const existingMatchByCandidate = new Map(existingMatches.map((match) => [match.candidateId, match]));

  const latestMatchActivity = jobReq.matchResults[0]?.createdAt ?? null;
  const jobFreshness = computeJobFreshnessScore({
    createdAt: jobReq.createdAt,
    updatedAt: jobReq.updatedAt,
    latestMatchActivity,
  });

  const startedAt = new Date();
  const agentRun = await createAgentRunLog(prisma, {
    agentName: "MATCH",
    tenantId,
    sourceType: "api",
    sourceTag: "match",
    input: parsed.data,
    inputSnapshot: parsed.data,
    status: "RUNNING",
    startedAt,
  });

  try {
    const matches = [] as Array<{
      matchResultId: string;
      candidateId: string;
      jobReqId: string;
      score: number;
      confidence: number;
      confidenceCategory: string;
      confidenceReasons: string[];
      breakdown: Record<string, unknown>;
      explanation: string;
    }>;

    for (const candidate of candidates) {
      const candidateSignals = computeCandidateSignalScore({
        candidate,
        jobCandidate: jobCandidateById.get(candidate.id),
        outreachInteractions: outreachByCandidateId.get(candidate.id) ?? 0,
      });

      const matchScore = computeMatchScore(
        { candidate, jobReq },
        { candidateSignals, jobFreshnessScore: jobFreshness.score },
      );

      const confidence = computeMatchConfidence({ candidate, jobReq });

      const breakdown = {
        score: matchScore.score,
        skillScore: matchScore.skillScore,
        seniorityScore: matchScore.seniorityScore,
        locationScore: matchScore.locationScore,
        candidateSignalScore: matchScore.candidateSignalScore,
        candidateSignalBreakdown: {
          ...(matchScore.candidateSignalBreakdown ?? {}),
          confidence,
        },
        jobFreshnessScore: jobFreshness.score,
        confidence,
      } as const;

      const jobDescription = jobReq.rawDescription?.trim() || null;

      const explanation = await buildMatchExplanation(
        jobReq.title,
        jobDescription,
        candidate.fullName,
        candidate.summary ?? candidate.rawResumeText ?? null,
        breakdown,
      );

      const existingResult = existingResultByCandidate.get(candidate.id);
      const existingMatch = existingMatchByCandidate.get(candidate.id);

      const savedMatchResult = await prisma.$transaction(async (tx) => {
        const data = {
          candidateId: candidate.id,
          jobReqId,
          score: matchScore.score,
          reasons: matchScore.explanation,
          skillScore: matchScore.skillScore,
          seniorityScore: matchScore.seniorityScore,
          locationScore: matchScore.locationScore,
          candidateSignalScore: matchScore.candidateSignalScore,
          candidateSignalBreakdown: {
            ...(matchScore.candidateSignalBreakdown ?? {}),
            confidence,
          },
          tenantId,
          agentRunId: agentRun.id,
        } as const;

        const result = existingResult
          ? await tx.matchResult.update({ where: { id: existingResult.id }, data })
          : await tx.matchResult.create({ data });

        await upsertJobCandidateForMatch(jobReqId, candidate.id, result.id, tenantId, tx);

        if (existingMatch) {
          await tx.match.update({
            where: { id: existingMatch.id },
            data: {
              overallScore: matchScore.score,
              scoreBreakdown: breakdown,
              explanation,
              createdByAgent: "MATCH",
              category: existingMatch.category ?? "Suggested",
            },
          });
        } else {
          await tx.match.create({
            data: {
              tenantId,
              jobReqId,
              candidateId: candidate.id,
              overallScore: matchScore.score,
              category: "Suggested",
              scoreBreakdown: breakdown,
              explanation,
              createdByAgent: "MATCH",
            },
          });
        }

        return result;
      });

      matches.push({
        matchResultId: savedMatchResult.id,
        candidateId: candidate.id,
        jobReqId,
        score: matchScore.score,
        confidence: confidence.score,
        confidenceCategory: confidence.category,
        confidenceReasons: confidence.reasons,
        breakdown,
        explanation,
      });
    }

    const sortedMatches = matches.sort((a, b) => b.score - a.score);
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    const snapshot = sortedMatches as unknown as Prisma.JsonArray;
    const outputData: Prisma.InputJsonObject = { snapshot, durationMs };

    await prisma.agentRunLog.update({
      where: { id: agentRun.id },
      data: {
        output: outputData,
        outputSnapshot: snapshot,
        status: "SUCCESS",
        durationMs,
        finishedAt,
      },
    });

    return NextResponse.json({ matches: sortedMatches, jobReqId, agentRunId: agentRun.id }, { status: 200 });
  } catch (err) {
    console.error("MATCH agent API error", err);
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    await prisma.agentRunLog.update({
      where: { id: agentRun.id },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        durationMs,
        finishedAt,
        output: { durationMs, errorCategory: "error" },
      },
    });

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
