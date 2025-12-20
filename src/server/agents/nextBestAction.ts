import { NextResponse } from "next/server";

import {
  assertValidNextBestActionResponse,
  NEXT_BEST_ACTION_PROMPT_VERSION,
  type NextBestActionLLMResponse,
} from "@/lib/agents/contracts/nextBestActionContract";
import { AgentRetryMetadata, withAgentRun } from "@/lib/agents/agentRun";
import { AGENT_PROMPTS, resolveAgentPrompt } from "@/lib/agents/promptRegistry";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { recordMetricEvent } from "@/lib/metrics/events";
import { callLLM } from "@/lib/llm";
import { OpenAIAdapter } from "@/lib/llm/openaiAdapter";
import { prisma } from "@/server/db/prisma";

export type PipelineHealthSnapshot = {
  agingDays: number;
  shortlistRate?: number | null;
  totalCandidates?: number | null;
  velocity?: number | null;
  blockers?: string[];
  triggerReasons?: string[];
};

export type ConfidenceDistributionSnapshot = {
  low: number;
  medium: number;
  high: number;
  sampleSize?: number;
};

export type EteSignalSnapshot = {
  marketRisk: "low" | "medium" | "high";
  scarcityIndex?: number | null;
  estimatedTimeToFillDays?: number | null;
};

export type NextBestActionInput = {
  jobId: string;
  recruiterId?: string;
  pipelineHealth: PipelineHealthSnapshot;
  confidenceDistribution: ConfidenceDistributionSnapshot;
  eteSignals: EteSignalSnapshot;
  sourceType?: string;
  sourceTag?: string;
};

export type NextBestActionResult = {
  jobId: string;
  recommendation: NextBestActionLLMResponse["recommendation"];
  agentRunId: string;
};

function requireJobId(jobId: unknown) {
  if (typeof jobId !== "string" || !jobId.trim()) {
    throw NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  return jobId.trim();
}

function formatPipelineHealth(health: PipelineHealthSnapshot): string {
  const parts = [
    `agingDays=${health.agingDays}`,
    health.shortlistRate != null ? `shortlistRate=${Math.round(health.shortlistRate * 100)}%` : null,
    health.totalCandidates != null ? `totalCandidates=${health.totalCandidates}` : null,
    health.velocity != null ? `velocity=${health.velocity.toFixed(2)} matches/day` : null,
    health.blockers?.length ? `blockers=${health.blockers.join("; ")}` : null,
    health.triggerReasons?.length ? `triggerReasons=${health.triggerReasons.join(", ")}` : null,
  ];

  return parts.filter(Boolean).join(" | ");
}

function formatConfidenceDistribution(distribution: ConfidenceDistributionSnapshot): string {
  const sampleLabel = distribution.sampleSize ? `sample=${distribution.sampleSize}` : "sample=unknown";
  const low = Math.round(distribution.low * 100);
  const med = Math.round(distribution.medium * 100);
  const high = Math.round(distribution.high * 100);

  return `${sampleLabel}; low=${low}%, medium=${med}%, high=${high}%`;
}

function formatEteSignals(signals: EteSignalSnapshot): string {
  const scarcity = signals.scarcityIndex != null ? `scarcityIndex=${signals.scarcityIndex}` : null;
  const ttf = signals.estimatedTimeToFillDays != null ? `p90TimeToFillDays=${signals.estimatedTimeToFillDays}` : null;

  return [`marketRisk=${signals.marketRisk}`, scarcity, ttf].filter(Boolean).join(" | ");
}

export async function runNextBestAction(
  input: NextBestActionInput,
  retryMetadata?: AgentRetryMetadata,
  llmAdapter?: OpenAIAdapter,
): Promise<NextBestActionResult> {
  const jobId = requireJobId(input.jobId);
  const job = await prisma.jobReq.findUnique({
    where: { id: jobId },
    select: { id: true, tenantId: true, title: true, status: true, location: true },
  });

  if (!job) {
    throw NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const promptContract = await resolveAgentPrompt(AGENT_PROMPTS.NBA_SYSTEM, {
    version: NEXT_BEST_ACTION_PROMPT_VERSION,
  });

  const [result, agentRunId] = await withAgentRun<NextBestActionResult>(
    {
      agentName: "ETE-TS.NEXT_BEST_ACTION",
      recruiterId: input.recruiterId,
      inputSnapshot: {
        jobId,
        promptVersion: promptContract.version,
        pipelineHealth: input.pipelineHealth,
        confidenceDistribution: input.confidenceDistribution,
        eteSignals: input.eteSignals,
      },
      sourceType: input.sourceType,
      sourceTag: input.sourceTag,
      ...retryMetadata,
    },
    async () => {
      const userPrompt = [
        `Job: ${job.title} (${job.status ?? "status-unknown"}) in ${job.location ?? "location-unknown"}`,
        `Pipeline health: ${formatPipelineHealth(input.pipelineHealth)}`,
        `Confidence distribution: ${formatConfidenceDistribution(input.confidenceDistribution)}`,
        `ETE signals: ${formatEteSignals(input.eteSignals)}`,
        "Return exactly one recommendation object following the JSON shape.",
      ].join("\n");

      const llmRaw = await callLLM({
        systemPrompt: promptContract.prompt,
        userPrompt,
        adapter: llmAdapter,
        agent: "NEXT_BEST_ACTION",
      });

      let parsed: NextBestActionLLMResponse;
      try {
        parsed = JSON.parse(llmRaw) as NextBestActionLLMResponse;
      } catch (err) {
        console.error("Failed to parse LLM JSON for NEXT_BEST_ACTION:", err, llmRaw);
        throw new Error("Failed to parse LLM JSON");
      }

      assertValidNextBestActionResponse(parsed);

      await recordMetricEvent({
        tenantId: job.tenantId ?? DEFAULT_TENANT_ID,
        eventType: "NEXT_BEST_ACTION_RECOMMENDATION",
        entityId: job.id,
        meta: {
          actionId: parsed.recommendation.actionId,
          owner: parsed.recommendation.owner,
          urgency: parsed.recommendation.urgency,
          triggerReasons: input.pipelineHealth.triggerReasons ?? null,
        },
      });

      return {
        result: { jobId: job.id, recommendation: parsed.recommendation, agentRunId: "" },
        outputSnapshot: parsed,
      } satisfies { result: NextBestActionResult; outputSnapshot: NextBestActionLLMResponse };
    },
  );

  return { ...result, agentRunId };
}
