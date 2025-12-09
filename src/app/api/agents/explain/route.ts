import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAgentRunLog } from "@/lib/agents/agentRunLog";
import { getTenantScopedPrismaClient, toTenantErrorResponse } from "@/lib/agents/tenantScope";
import { requireRole } from "@/lib/auth/requireRole";
import { USER_ROLES } from "@/lib/auth/roles";
import { callLLM } from "@/lib/llm";
import { makeDeterministicExplanation, normalizeMatchExplanation } from "@/lib/matching/explanation";

const requestSchema = z
  .object({
    matchId: z.string().trim().min(1).optional(),
    candidateMatchId: z.string().trim().min(1).optional(),
  })
  .refine((value) => value.matchId || value.candidateMatchId, {
    message: "matchId or candidateMatchId is required",
  })
  .refine((value) => !(value.matchId && value.candidateMatchId), {
    message: "Provide either matchId or candidateMatchId, not both",
  });

const AGENT_NAME = "EAT-TS.EXPLAIN";

function truncate(value: string | null | undefined, max = 2000) {
  if (!value) return null;
  return value.slice(0, max);
}

function collectCandidateSkills(
  candidate: {
    normalizedSkills?: string[] | null;
    skills?: Array<{ name: string; normalizedName: string }>;
  },
) {
  const skills = new Set<string>();

  (candidate.normalizedSkills ?? []).forEach((skill) => skills.add(skill));
  (candidate.skills ?? []).forEach((skill) => skills.add(skill.normalizedName || skill.name));

  return Array.from(skills);
}

function buildSystemPrompt() {
  return `You are an AI recruiting assistant.
You must explain the match using only the structured data provided.
Never invent employment history, employers, education, dates, or skills that are not explicitly listed.
If information is missing, say "Not provided" instead of guessing.
Respond with valid JSON using exactly these keys: topReasons (string[]), allReasons (string[]), skillOverlapMap (array of {skill, status (matched|missing), importance (required|preferred), weight (number), note}), riskAreas (string[]), missingSkills (string[]), exportableText (string).
Keep text concise and fact-based.`;
}

function buildUserPrompt(data: Record<string, unknown>) {
  return `Use ONLY the facts in the following JSON to explain the match. Do not reference or assume anything else.
DATA:
${JSON.stringify(data, null, 2)}
Return JSON only.`;
}

export async function POST(req: NextRequest) {
  const roleCheck = await requireRole(req, [USER_ROLES.ADMIN, USER_ROLES.RECRUITER]);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((issue) => issue.message).join("; ") },
      { status: 400 },
    );
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

  const { prisma: scopedPrisma, tenantId, runWithTenantContext } = scopedTenant;
  const { matchId, candidateMatchId } = parsed.data;

  return runWithTenantContext(async () => {
    const match = matchId
      ? await scopedPrisma.match.findFirst({
          where: { id: matchId, tenantId },
          include: {
            jobReq: { include: { skills: true } },
            candidate: { include: { skills: true } },
          },
        })
      : await scopedPrisma.candidateMatch.findFirst({
          where: { id: candidateMatchId, tenantId },
          include: {
            job: true,
            candidate: { include: { skills: true } },
          },
        });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const job = "jobReq" in match ? match.jobReq : match.job;
    const candidate = match.candidate;
    const jobTitle = job.title;
    const jobDescription = truncate("rawDescription" in job ? job.rawDescription : job.description);
    const jobSkills = "skills" in job ? job.skills.map((skill) => skill.normalizedName || skill.name) : job.requiredSkills;
    const candidateSkills = collectCandidateSkills(candidate);

    const promptData = {
      matchId: match.id,
      job: {
        title: jobTitle,
        description: jobDescription ?? "Not provided",
        skills: jobSkills,
      },
      candidate: {
        name: candidate.fullName,
        title: candidate.currentTitle ?? "Not provided",
        location: candidate.location ?? "Not provided",
        summary: truncate(candidate.summary) ?? "Not provided",
        skills: candidateSkills,
      },
      match: {
        score: "overallScore" in match ? match.overallScore : match.matchScore,
        existingExplanation: "explanation" in match ? match.explanation : null,
      },
    };

    const startedAt = new Date();
    const agentRun = await createAgentRunLog(scopedPrisma, {
      agentName: AGENT_NAME,
      tenantId,
      sourceType: "api",
      sourceTag: "agents/explain",
      input: parsed.data,
      inputSnapshot: promptData,
      status: "RUNNING",
      startedAt,
    });

    try {
      const rawResponse = await callLLM({
        systemPrompt: buildSystemPrompt(),
        userPrompt: buildUserPrompt(promptData),
      });

      let llmPayload: unknown = rawResponse;

      try {
        llmPayload = JSON.parse(rawResponse);
      } catch {
        // Fall back to raw text if JSON parsing fails
      }

      const parsedResponse = normalizeMatchExplanation(llmPayload);
      const explanation = makeDeterministicExplanation(parsedResponse);

      const finishedAt = new Date();
      await scopedPrisma.agentRunLog.update({
        where: { id: agentRun.id },
        data: {
          status: "SUCCESS",
          output: { snapshot: explanation },
          outputSnapshot: explanation,
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
        },
      });

      return NextResponse.json({ explanation, agentRunId: agentRun.id }, { status: 200 });
    } catch (error) {
      const finishedAt = new Date();
      await scopedPrisma.agentRunLog.update({
        where: { id: agentRun.id },
        data: {
          status: "FAILED",
          errorMessage: (error as Error)?.message ?? "Unknown error",
          output: { snapshot: { error: (error as Error)?.message ?? "Unknown error" } },
          outputSnapshot: { error: (error as Error)?.message ?? "Unknown error" },
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
        },
      });

      console.error("Explain agent failed", error);
      return NextResponse.json({ error: "Failed to generate explanation" }, { status: 500 });
    }
  });
}
