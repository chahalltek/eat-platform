import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { Prisma, UsageEventType } from "@prisma/client";

import { getAgentAvailability } from "@/lib/agents/agentAvailability";
import { createAgentRunLog } from "@/lib/agents/agentRunLog";
import { AGENT_KILL_SWITCHES, enforceAgentKillSwitch } from "@/lib/agents/killSwitch";
import { getTenantScopedPrismaClient, toTenantErrorResponse } from "@/lib/agents/tenantScope";
import { runMatch } from "@/lib/agents/matchEngine";
import { agentFeatureGuard } from "@/lib/featureFlags/middleware";
import { requireRole } from "@/lib/auth/requireRole";
import { USER_ROLES } from "@/lib/auth/roles";
import { callLLM } from "@/lib/llm";
import { upsertJobCandidateForMatch } from "@/lib/matching/jobCandidate";
import { guardrailsPresets } from "@/lib/guardrails/presets";
import { loadTenantConfig } from "@/lib/guardrails/tenantConfig";
import { recordUsageEvent } from "@/lib/usage/events";

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
  llmEnabled: boolean,
) {
  if (!llmEnabled) {
    return "Fire Drill mode: using deterministic scoring";
  }

  const systemPrompt =
    "You are a recruiting assistant. Given a job and candidate profile, explain why the candidate matches.";
  const userPrompt = `Job: ${jobTitle}\nDescription: ${jobDescription ?? "N/A"}\nCandidate: ${candidateName}\nSummary: ${candidateSummary ?? "N/A"}\nDeterministic scores: ${JSON.stringify(
    deterministicBreakdown,
  )}\nWrite a concise, bullet-point match rationale.`;

  try {
    return await callLLM({ systemPrompt, userPrompt, agent: "MATCH_EXPLAIN" });
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
    return NextResponse.json({ error: "MATCH agent is disabled" }, { status: 403 });
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
          thresholds: conservativePreset.scoring.thresholds,
        },
        safety: {
          ...conservativePreset.safety,
          ...(guardrailsConfig.safety ?? {}),
        },
      };
    }

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

    const [existingMatchResults, existingMatches] = await Promise.all([
      scopedPrisma.matchResult.findMany({
        where: { tenantId, jobReqId, candidateId: { in: candidateIdList } },
      }),
      scopedPrisma.match.findMany({
        where: { tenantId, jobReqId, candidateId: { in: candidateIdList } },
      }),
    ]);

    const existingResultByCandidate = new Map(
      existingMatchResults.map((result) => [result.candidateId, result]),
    );
    const existingMatchByCandidate = new Map(existingMatches.map((match) => [match.candidateId, match]));

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
      const matchResults = runMatch({
        job: {
          id: jobReq.id,
          location: jobReq.location,
          seniorityLevel: jobReq.seniorityLevel ?? undefined,
          skills: jobReq.skills,
        },
        candidates: candidates.map((candidate) => ({
          id: candidate.id,
          location: candidate.location,
          totalExperienceYears: candidate.totalExperienceYears ?? null,
          seniorityLevel: candidate.seniorityLevel ?? undefined,
          skills: candidate.skills,
        })),
        config: guardrailsConfig,
      });

      const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
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

      for (const match of matchResults) {
        const candidate = candidateById.get(match.candidateId);
        if (!candidate) {
          continue;
        }

        const averageSignal =
          (match.signals.mustHaveSkillsCoverage +
            match.signals.niceToHaveSkillsCoverage +
            match.signals.experienceAlignment +
            match.signals.locationAlignment) /
          4;
        const confidenceScore = Math.round(averageSignal * 100);
        const confidenceCategory = confidenceScore >= 75 ? "HIGH" : confidenceScore >= 50 ? "MEDIUM" : "LOW";
        const confidence = {
          score: confidenceScore,
          category: confidenceCategory,
          reasons: [] as string[],
        };
        const guardrails: Prisma.JsonObject = {
          strategy: (guardrailsConfig.scoring as { strategy?: string } | undefined)?.strategy ?? "weighted",
          thresholds: (guardrailsConfig.scoring as { thresholds?: Prisma.JsonValue } | undefined)?.thresholds ?? null,
        };

        const candidateSignalBreakdown: Prisma.JsonObject = {
          signals: match.signals,
          confidence,
          guardrails,
        };

        const breakdown: Prisma.JsonObject = {
          score: match.score,
          signals: match.signals,
          guardrails,
          confidence,
        };

        const jobDescription = jobReq.rawDescription?.trim() || null;

        const explanation = await buildMatchExplanation(
          jobReq.title,
          jobDescription,
          candidate.fullName,
          candidate.summary ?? candidate.rawResumeText ?? null,
          breakdown,
          availability.isEnabled("EXPLAIN"),
        );

        const existingResult = existingResultByCandidate.get(match.candidateId);
        const existingMatch = existingMatchByCandidate.get(match.candidateId);

        const savedMatchResult = await scopedPrisma.$transaction(async (tx) => {
          const data = {
            candidateId: match.candidateId,
            jobReqId,
            score: match.score,
            reasons: breakdown,
            skillScore: Math.round(match.signals.mustHaveSkillsCoverage * 100),
            seniorityScore: Math.round(match.signals.experienceAlignment * 100),
            locationScore: Math.round(match.signals.locationAlignment * 100),
            candidateSignalScore: Math.round(match.signals.niceToHaveSkillsCoverage * 100),
            candidateSignalBreakdown,
            tenantId,
            agentRunId: agentRun.id,
          } as const;

          const result = existingResult
            ? await tx.matchResult.update({ where: { id: existingResult.id }, data })
            : await tx.matchResult.create({ data });

          await upsertJobCandidateForMatch(jobReqId, match.candidateId, result.id, tenantId, tx);

          if (existingMatch) {
            await tx.match.update({
              where: { id: existingMatch.id },
              data: {
                overallScore: match.score,
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
                candidateId: match.candidateId,
                overallScore: match.score,
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
          candidateId: match.candidateId,
          jobReqId,
          score: match.score,
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
