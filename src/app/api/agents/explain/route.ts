import { NextRequest, NextResponse } from "next/server";
<<<<<<< ours
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
=======

import { agentFeatureGuard } from "@/lib/featureFlags/middleware";
import { getCurrentUser } from "@/lib/auth/user";
import { callLLM } from "@/lib/llm";
import { toRateLimitResponse } from "@/lib/rateLimiting/http";
import { isRateLimitError } from "@/lib/rateLimiting/rateLimiter";

const systemPrompt = "You are an explainability agent for recruiters. Use only provided facts.";

type ExplainRequestBody = {
  jobId?: unknown;
  candidateId?: unknown;
  jobTitle?: unknown;
  candidateName?: unknown;
  candidateTitle?: unknown;
  candidateLocation?: unknown;
  candidateSkills?: unknown;
  jobSkills?: unknown;
  matchScore?: unknown;
  confidenceScore?: unknown;
};

type ExplainAgentResult = {
  summary: string;
  strengths: string[];
  risks: string[];
  systemFacts: {
    jobTitle?: string;
    candidateName?: string;
    candidateTitle?: string | null;
    candidateLocation?: string | null;
    candidateSkills?: string[];
    jobSkills?: string[];
    matchScore?: number | null;
    confidenceScore?: number | null;
  };
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildUserPrompt(body: ExplainRequestBody) {
  const jobTitle = typeof body.jobTitle === "string" ? body.jobTitle.trim() : "Unknown job";
  const candidateName = typeof body.candidateName === "string" ? body.candidateName.trim() : "Unknown candidate";
  const candidateTitle = typeof body.candidateTitle === "string" ? body.candidateTitle.trim() : "Unknown title";
  const candidateLocation = typeof body.candidateLocation === "string" ? body.candidateLocation.trim() : "Unknown location";
  const candidateSkills = toStringArray(body.candidateSkills);
  const jobSkills = toStringArray(body.jobSkills);
  const matchScore = toNumber(body.matchScore);
  const confidenceScore = toNumber(body.confidenceScore);

  const facts = [
    `Job title: ${jobTitle}`,
    `Candidate: ${candidateName}`,
    `Candidate title: ${candidateTitle}`,
    `Candidate location: ${candidateLocation}`,
    `Candidate skills: ${candidateSkills.join(", ") || "(no skills)"}`,
    `Job skills: ${jobSkills.join(", ") || "(no skills)"}`,
    `Match score: ${typeof matchScore === "number" ? `${matchScore}%` : "(not provided)"}`,
    `Confidence: ${typeof confidenceScore === "number" ? `${confidenceScore}%` : "(not provided)"}`,
  ].join("\n");

  return `Use only the following facts. Do not invent details outside this list.\n${facts}\n\nReturn JSON with keys: summary (<=80 words), strengths (3 bullet points, <=20 words each), risks (3 bullet points, <=20 words each). Keep statements grounded in the facts above.`;
}

function parseExplainResponse(text: string): Pick<ExplainAgentResult, "summary" | "strengths" | "risks"> {
  try {
    const parsed = JSON.parse(text) as Partial<ExplainAgentResult>;
    const strengths = Array.isArray(parsed.strengths)
      ? parsed.strengths.filter((entry): entry is string => typeof entry === "string")
      : [];
    const risks = Array.isArray(parsed.risks)
      ? parsed.risks.filter((entry): entry is string => typeof entry === "string")
      : [];

    const summary = typeof parsed.summary === "string" ? parsed.summary : text.slice(0, 300);

    return { summary, strengths, risks };
  } catch {
    return { summary: text.slice(0, 300), strengths: [], risks: [] };
  }
}

export async function POST(req: NextRequest) {
  let body: ExplainRequestBody;

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const flagCheck = await agentFeatureGuard();
  if (flagCheck) {
    return flagCheck;
  }

  try {
    body = (await req.json()) as ExplainRequestBody;
  } catch (err) {
    console.error("EXPLAIN API invalid JSON:", err);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
  const candidateId = typeof body.candidateId === "string" ? body.candidateId.trim() : "";

  if (!jobId || !candidateId) {
    return NextResponse.json({ error: "jobId and candidateId are required" }, { status: 400 });
  }

  const candidateName = typeof body.candidateName === "string" ? body.candidateName.trim() : "Unknown";

  try {
    const userPrompt = buildUserPrompt(body);
    const completion = await callLLM({ systemPrompt, userPrompt });
    const parsed = parseExplainResponse(completion);

    const response: ExplainAgentResult = {
      summary: parsed.summary,
      strengths: parsed.strengths,
      risks: parsed.risks,
      systemFacts: {
        jobTitle: typeof body.jobTitle === "string" ? body.jobTitle.trim() : undefined,
        candidateName,
        candidateTitle: typeof body.candidateTitle === "string" ? body.candidateTitle.trim() : null,
        candidateLocation: typeof body.candidateLocation === "string" ? body.candidateLocation.trim() : null,
        candidateSkills: toStringArray(body.candidateSkills),
        jobSkills: toStringArray(body.jobSkills),
        matchScore: toNumber(body.matchScore),
        confidenceScore: toNumber(body.confidenceScore),
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("EXPLAIN API error:", err);

    if (isRateLimitError(err)) {
      return toRateLimitResponse(err);
    }

    return NextResponse.json({ error: "Failed to run explain agent" }, { status: 500 });
  }
>>>>>>> theirs
}
