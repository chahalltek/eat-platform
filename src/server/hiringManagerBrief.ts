import { NextResponse } from "next/server";

import {
  assertValidHiringManagerBrief,
  HIRING_MANAGER_BRIEF_PROMPT_VERSION,
  type HiringManagerBriefPayload,
} from "@/lib/agents/contracts/hiringManagerBriefContract";
import { AGENTS } from "@/lib/agents/agentAvailability";
import { AgentRetryMetadata, withAgentRun } from "@/lib/agents/agentRun";
import { AGENT_PROMPTS, resolveAgentPrompt } from "@/lib/agents/promptRegistry";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { callLLM } from "@/lib/llm";
import { OpenAIAdapter } from "@/lib/llm/openaiAdapter";
import { prisma } from "@/server/db";

export type HiringManagerBriefInput = {
  jobId: string;
  recruiterId?: string;
  sourceType?: string;
  sourceTag?: string;
};

export type HiringManagerBriefResult = {
  jobId: string;
  briefId: string;
  content: HiringManagerBriefPayload;
  status: "DRAFT" | "READY" | "SENT";
  agentRunId: string;
};

type CandidateSnapshot = {
  candidateId: string;
  name: string;
  headline: string | null;
  matchScore: number | null;
  confidenceBand: string | null;
  status: string;
  summary: string | null;
};

function requireJobId(jobId: unknown) {
  if (typeof jobId !== "string" || !jobId.trim()) {
    throw NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  return jobId.trim();
}

function toCandidateSnapshot(candidate: CandidateSnapshot): string {
  const headline = candidate.headline ?? "headline-unavailable";
  const match = candidate.matchScore != null ? `matchScore=${candidate.matchScore}` : "matchScore=unknown";
  const confidence = candidate.confidenceBand ?? "confidence=unknown";
  const status = candidate.status ?? "status=unknown";
  const summary = candidate.summary ?? "no summary provided";

  return `- ${candidate.name} [${candidate.candidateId}] :: ${headline} | ${match} | ${confidence} | ${status} | summary=${summary}`;
}

function rankCandidates(candidates: CandidateSnapshot[]): CandidateSnapshot[] {
  return [...candidates].sort((a, b) => {
    const scoreA = a.matchScore ?? -Infinity;
    const scoreB = b.matchScore ?? -Infinity;

    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }

    return (b.confidenceBand ? 1 : 0) - (a.confidenceBand ? 1 : 0);
  });
}

export async function generateHiringManagerBrief(
  input: HiringManagerBriefInput,
  retryMetadata?: AgentRetryMetadata,
  llmAdapter?: OpenAIAdapter,
): Promise<HiringManagerBriefResult> {
  const jobId = requireJobId(input.jobId);
  const job = await prisma.jobReq.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      tenantId: true,
      title: true,
      seniorityLevel: true,
      location: true,
      employmentType: true,
      jobIntent: { select: { intent: true } },
      jobCandidates: {
        select: {
          candidateId: true,
          status: true,
          confidenceBand: true,
          confidenceScore: true,
          candidate: {
            select: {
              fullName: true,
              currentTitle: true,
              currentCompany: true,
              location: true,
              summary: true,
            },
          },
          lastMatch: { select: { score: true } },
        },
      },
    },
  });

  if (!job) {
    throw NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const intentSnapshot = job.jobIntent?.intent ?? null;
  const candidateSnapshots: CandidateSnapshot[] = job.jobCandidates.map((jobCandidate) => {
    const headlineParts = [jobCandidate.candidate.currentTitle, jobCandidate.candidate.currentCompany].filter(Boolean);
    const headline = headlineParts.length ? headlineParts.join(" @ ") : jobCandidate.candidate.location ?? null;

    return {
      candidateId: jobCandidate.candidateId,
      name: jobCandidate.candidate.fullName,
      headline,
      matchScore: jobCandidate.lastMatch?.score ?? jobCandidate.confidenceScore ?? null,
      confidenceBand: jobCandidate.confidenceBand ?? null,
      status: jobCandidate.status,
      summary: jobCandidate.candidate.summary ?? null,
    } satisfies CandidateSnapshot;
  });

  const topCandidates = rankCandidates(candidateSnapshots).slice(0, 3);

  const promptContract = await resolveAgentPrompt(AGENT_PROMPTS.HIRING_MANAGER_BRIEF, {
    version: HIRING_MANAGER_BRIEF_PROMPT_VERSION,
  });

  const [briefContent, agentRunId] = await withAgentRun<HiringManagerBriefPayload>(
    {
      agentName: AGENTS.HIRING_MANAGER_BRIEF,
      recruiterId: input.recruiterId,
      inputSnapshot: {
        jobId,
        promptVersion: promptContract.version,
        intentProvided: Boolean(intentSnapshot),
        candidateCount: candidateSnapshots.length,
      },
      sourceType: input.sourceType,
      sourceTag: input.sourceTag,
      ...retryMetadata,
    },
    async () => {
      const userPrompt = [
        `Job: ${job.title} (${job.seniorityLevel ?? "seniority-unknown"}) in ${job.location ?? "location-unknown"}`,
        `Employment: ${job.employmentType ?? "employment-unknown"}`,
        `Role intent JSON: ${intentSnapshot ? JSON.stringify(intentSnapshot) : "null"}`,
        "Top candidates:",
        topCandidates.length ? topCandidates.map(toCandidateSnapshot).join("\n") : "- None available",
        "Generate the hiring manager brief using the required JSON shape.",
      ].join("\n");

      const llmRaw = await callLLM({
        systemPrompt: promptContract.prompt,
        userPrompt,
        adapter: llmAdapter,
        agent: "HIRING_MANAGER_BRIEF",
      });

      let parsed: HiringManagerBriefPayload;
      try {
        parsed = JSON.parse(llmRaw) as HiringManagerBriefPayload;
      } catch (error) {
        console.error("Failed to parse LLM JSON for HIRING_MANAGER_BRIEF:", error, llmRaw);
        throw new Error("Failed to parse LLM JSON");
      }

      assertValidHiringManagerBrief(parsed);

      return { result: parsed, outputSnapshot: parsed };
    },
  );

  const briefRecord = await prisma.hiringManagerBrief.create({
    data: {
      jobReqId: job.id,
      tenantId: job.tenantId ?? DEFAULT_TENANT_ID,
      content: briefContent,
      status: "DRAFT",
      createdBy: input.recruiterId ?? "agent",
    },
  });

  return {
    jobId: job.id,
    briefId: briefRecord.id,
    content: briefContent,
    status: briefRecord.status,
    agentRunId,
  };
}
