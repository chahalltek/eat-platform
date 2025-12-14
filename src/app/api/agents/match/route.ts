import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { Prisma, UsageEventType } from "@/server/db";

import { getAgentAvailability } from "@/lib/agents/agentAvailability";
import { createAgentRunLog } from "@/lib/agents/agentRunLog";
import { AGENT_KILL_SWITCHES, enforceAgentKillSwitch } from "@/lib/agents/killSwitch";
import { getTenantScopedPrismaClient, toTenantErrorResponse } from "@/lib/agents/tenantScope";
import { agentFeatureGuard } from "@/lib/featureFlags/middleware";
import { requireRole } from "@/lib/auth/requireRole";
import { USER_ROLES } from "@/lib/auth/roles";
import { upsertJobCandidateForMatch } from "@/lib/matching/jobCandidate";
import { guardrailsPresets } from "@/lib/guardrails/presets";
import { loadTenantConfig } from "@/lib/guardrails/tenantConfig";
import { recordUsageEvent } from "@/lib/usage/events";
import { computeMatchScore } from "@/lib/matching/msa";
import { computeCandidateSignalScore } from "@/lib/matching/candidateSignals";
import { computeJobFreshnessScore } from "@/lib/matching/freshness";
import { computeMatchConfidence } from "@/lib/matching/confidence";

const requestSchema = z.object({
  jobReqId: z.string().trim().min(1, "jobReqId is required"),
  candidateIds: z
    .array(z.string().trim().min(1))
    .optional()
    .refine((ids) => !ids || ids.length > 0, "candidateIds cannot be empty"),
  limit: z.number().int().positive().max(500).optional(),
});

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

  const roleCheck = await requireRole(req, [USER_ROLES.ADMIN, USER_ROLES.RECRUITER]);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const flagCheck = await agentFeatureGuard();

  if (flagCheck) {
    return flagCheck;
  }

  let scopedTenant;
  try {
    scopedTenant = await getTenantScopedPrismaClient(req);
  } catch (error) {
    const tenantError = toTenantErrorResponse(error);

    if (tenantError) {
      return tenantError;
    }

    throw error;
  }

  const { tenantId, runWithTenantContext, prisma: scopedPrisma } = scopedTenant;

  const [availability, killSwitchResponse] = await Promise.all([
    getAgentAvailability(tenantId),
    enforceAgentKillSwitch(AGENT_KILL_SWITCHES.MATCHER, tenantId),
  ]);

  if (killSwitchResponse) {
    return killSwitchResponse;
  }

  if (!availability.isEnabled("MATCH")) {
    return NextResponse.json({ matches: [], jobReqId, agentRunId: null }, { status: 200 });
  }

  return runWithTenantContext(async () => {
    const jobReq = await scopedPrisma.jobReq.findUnique({
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

    const modeName = availability.mode.mode ?? "pilot";
    const conservativePreset = guardrailsPresets.conservative;

    let guardrailsConfig = await loadTenantConfig(tenantId);

    if (modeName === "fire_drill") {
      guardrailsConfig = {
        ...guardrailsConfig,
        scoring: {
          ...conservativePreset.scoring,
          ...(guardrailsConfig.scoring ?? {}),
          strategy: "simple",
          thresholds:
            (guardrailsConfig.scoring as { thresholds?: Prisma.JsonValue } | undefined)?.thresholds ??
            conservativePreset.scoring.thresholds,
        },
        safety: {
          ...conservativePreset.safety,
          ...(guardrailsConfig.safety ?? {}),
        },
      };
    }

    const guardrailsJson = structuredClone(guardrailsConfig) as Prisma.JsonObject;

    const scoringConfig = (guardrailsConfig.scoring ?? {}) as {
      strategy?: string;
      thresholds?: { minMatchScore?: number };
      weights?: { mustHaveSkills?: number; niceToHaveSkills?: number; experience?: number; location?: number };
    };

    const safetyConfig = (guardrailsConfig.safety ?? {}) as { requireMustHaves?: boolean };
    const matcherWeights = scoringConfig.weights ?? {};
    const skillsWeight = (matcherWeights.mustHaveSkills ?? 0) + (matcherWeights.niceToHaveSkills ?? 0);
    const seniorityWeight = matcherWeights.experience ?? 0;
    const locationWeight = matcherWeights.location ?? 0;
    const candidateSignalsWeight = Math.max(0, 1 - (skillsWeight + seniorityWeight + locationWeight));

    const matcherConfig = {
      mode: scoringConfig.strategy === "simple" ? "simple" : "mixed",
      weights: {
        skills: skillsWeight || 0.4,
        seniority: seniorityWeight || 0.25,
        location: locationWeight || 0.15,
        candidateSignals: candidateSignalsWeight || 0.2,
      },
    } as const;

    const thresholdValue = (scoringConfig.thresholds as { minMatchScore?: number } | undefined)?.minMatchScore;
    const conservativeThreshold =
      (conservativePreset.scoring as { thresholds?: { minMatchScore?: number } } | undefined)?.thresholds?.minMatchScore;
    const minMatchScore = thresholdValue ?? conservativeThreshold ?? 0;
    const normalizedMinScore = minMatchScore <= 1 ? Math.round((minMatchScore || 0) * 100) : Math.round(minMatchScore);

    const candidates = await scopedPrisma.candidate.findMany({
      where: candidateWhere,
      include: { skills: true },
      orderBy: { createdAt: "desc" },
      take: candidateIds ? undefined : limit,
    });

    if (candidates.length === 0) {
      return NextResponse.json({ matches: [], jobReqId, agentRunId: null }, { status: 200 });
    }

    const candidateIdList = candidates.map((candidate) => candidate.id);

    const [existingMatchResults, existingMatches, jobCandidates, outreachInteractions] = await Promise.all([
      scopedPrisma.matchResult.findMany({
        where: { tenantId, jobReqId, candidateId: { in: candidateIdList } },
      }),
      scopedPrisma.match.findMany({
        where: { tenantId, jobReqId, candidateId: { in: candidateIdList } },
      }),
      scopedPrisma.jobCandidate.findMany({
        where: { tenantId, jobReqId, candidateId: { in: candidateIdList } },
      }),
      scopedPrisma.outreachInteraction.groupBy({
        by: ["candidateId"],
        where: { tenantId, jobReqId, candidateId: { in: candidateIdList } },
        _count: { _all: true },
      }),
    ]);

    const existingResultByCandidate = new Map(
      existingMatchResults.map((result) => [result.candidateId, result]),
    );
    const existingMatchByCandidate = new Map(existingMatches.map((match) => [match.candidateId, match]));
    const jobCandidateById = new Map(jobCandidates.map((entry) => [entry.candidateId, entry]));
    const outreachByCandidateId = new Map(
      outreachInteractions.map((interaction) => [interaction.candidateId, interaction._count._all]),
    );

    const startedAt = new Date();
    const agentRun = await createAgentRunLog(scopedPrisma, {
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

      const latestMatchActivity = jobReq.matchResults[0]?.createdAt ?? null;
      const jobFreshness = computeJobFreshnessScore({
        createdAt: jobReq.createdAt,
        updatedAt: jobReq.updatedAt,
        latestMatchActivity,
      });

      for (const candidate of candidates) {
        const candidateSignals = computeCandidateSignalScore({
          candidate,
          jobCandidate: jobCandidateById.get(candidate.id),
          outreachInteractions: outreachByCandidateId.get(candidate.id) ?? 0,
        });

        const matchScore = computeMatchScore(
          { candidate, jobReq },
          {
            jobFreshnessScore: jobFreshness.score,
            candidateSignals,
            matcherConfig,
            guardrails: { requireMustHaveSkills: Boolean(safetyConfig.requireMustHaves) },
            explain: true,
          },
        );

        if (matchScore.score < normalizedMinScore) {
          continue;
        }

        const confidence = computeMatchConfidence({ candidate, jobReq });

        const candidateSignalBreakdown: Prisma.JsonObject = {
          ...(candidateSignals.breakdown ?? {}),
          confidence,
        };

        const breakdown: Prisma.JsonObject = {
          matchScore,
          guardrails: guardrailsJson,
          candidateSignals: candidateSignals.breakdown ?? null,
        };

        const explanation = matchScore.explanation.exportableText;
        const existingResult = existingResultByCandidate.get(candidate.id);
        const existingMatch = existingMatchByCandidate.get(candidate.id);

        const savedMatchResult = await scopedPrisma.$transaction(async (tx) => {
          const data = {
            candidateId: candidate.id,
            jobReqId,
            score: matchScore.score,
            reasons: breakdown,
            skillScore: matchScore.skillScore,
            seniorityScore: matchScore.seniorityScore,
            locationScore: matchScore.locationScore,
            candidateSignalScore: matchScore.candidateSignalScore ?? candidateSignals.score,
            candidateSignalBreakdown,
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

      await scopedPrisma.agentRunLog.update({
        where: { id: agentRun.id },
        data: {
          output: outputData,
          outputSnapshot: snapshot,
          status: "SUCCESS",
          durationMs,
          finishedAt,
        },
      });

      void recordUsageEvent({
        tenantId,
        eventType: "CANDIDATES_EVALUATED" as UsageEventType,
        count: candidates.length,
        metadata: { jobReqId },
      });

      return NextResponse.json(
        { matches: sortedMatches, jobReqId, agentRunId: agentRun.id },
        { status: 200 },
      );
    } catch (err) {
      console.error("MATCH agent API error", err);
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();

      await scopedPrisma.agentRunLog.update({
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
  });
}
