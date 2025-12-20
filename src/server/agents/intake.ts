import { NextResponse } from "next/server";

import {
  assertValidJobIntakeProfile,
  INTAKE_PROMPT_VERSION,
  type JobIntakeProfile,
} from "@/lib/agents/contracts/intakeContract";
import { AgentRetryMetadata, withAgentRun } from "@/lib/agents/agentRun";
import { AGENT_PROMPTS, resolveAgentPrompt } from "@/lib/agents/promptRegistry";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { recordMetricEvent } from "@/lib/metrics/events";
import { callLLM } from "@/lib/llm";
import { OpenAIAdapter } from "@/lib/llm/openaiAdapter";
import { prisma } from "@/server/db/prisma";

export type IntakeInput = {
  jobId: string;
  sourceType?: string;
  sourceTag?: string;
};

export type IntakeResult = {
  jobId: string;
  jobIntent: JobIntakeProfile;
  agentRunId: string;
};

function requireJobId(jobId: unknown) {
  if (typeof jobId !== "string" || !jobId.trim()) {
    throw NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  return jobId.trim();
}

export async function runIntake(
  input: IntakeInput & { recruiterId?: string },
  retryMetadata?: AgentRetryMetadata,
  llmAdapter?: OpenAIAdapter,
): Promise<IntakeResult> {
  const jobId = requireJobId(input.jobId);
  const job = await prisma.jobReq.findUnique({
    where: { id: jobId },
    select: { id: true, tenantId: true, rawDescription: true },
  });

  if (!job) {
    throw NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const promptContract = await resolveAgentPrompt(AGENT_PROMPTS.RUA_SYSTEM, {
    version: INTAKE_PROMPT_VERSION,
  });

  const [result, agentRunId] = await withAgentRun<JobIntakeProfile>(
    {
      agentName: "ETE-TS.INTAKE",
      recruiterId: input.recruiterId,
      inputSnapshot: {
        jobId,
        promptVersion: promptContract.version,
        sourceType: input.sourceType,
        sourceTag: input.sourceTag,
      },
      sourceType: input.sourceType,
      sourceTag: input.sourceTag,
      ...retryMetadata,
    },
    async () => {
      const llmRaw = await callLLM({
        systemPrompt: promptContract.prompt,
        userPrompt: `Job Description:\n"""${job.rawDescription}"""`,
        adapter: llmAdapter,
        agent: "INTAKE",
      });

      let parsed: JobIntakeProfile;
      try {
        parsed = JSON.parse(llmRaw) as JobIntakeProfile;
      } catch (err) {
        console.error("Failed to parse LLM JSON for INTAKE:", err, llmRaw);
        throw new Error("Failed to parse LLM JSON");
      }

      assertValidJobIntakeProfile(parsed);

      await prisma.$transaction(async (tx) => {
        await tx.jobSkill.deleteMany({ where: { jobReqId: job.id, tenantId: job.tenantId } });
        await tx.jobReq.update({
          where: { id: job.id },
          data: {
            title: parsed.title,
            seniorityLevel: parsed.seniorityLevel ?? null,
            location: parsed.location ?? null,
            employmentType: parsed.employmentType ?? null,
            status: parsed.status ?? null,
            skills: {
              create: parsed.skills.map((skill) => ({
                tenantId: job.tenantId ?? DEFAULT_TENANT_ID,
                name: skill.name,
                normalizedName: skill.normalizedName || skill.name,
                required: skill.isMustHave ?? false,
              })),
            },
          },
        });
      });

      await recordMetricEvent({
        tenantId: job.tenantId ?? DEFAULT_TENANT_ID,
        eventType: "DECISION_STREAM_ITEM",
        entityId: job.id,
        meta: {
          action: "INTAKE_RESULT",
          jobId: job.id,
          intent: parsed,
        },
      });

      return { result: parsed, outputSnapshot: parsed };
    },
  );

  return { jobId: job.id, jobIntent: result, agentRunId };
}
