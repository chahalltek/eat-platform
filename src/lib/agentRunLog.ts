import { AgentRunStatus, Prisma, type UsageEventType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { recordUsageEvent } from "@/lib/usage/events";

function normalizeJsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === undefined) {
    return {} as Prisma.InputJsonValue;
  }

  return value as Prisma.InputJsonValue;
}

export async function startAgentRun({
  agentName,
  tenantId,
  userId,
  input,
}: {
  agentName: string;
  tenantId: string;
  userId?: string;
  input?: unknown;
}) {
  const normalizedInput = normalizeJsonValue(input);

  const run = await prisma.agentRunLog.create({
    data: {
      agentName,
      tenantId,
      userId,
      input: normalizedInput,
      inputSnapshot: normalizedInput,
      status: AgentRunStatus.RUNNING,
      startedAt: new Date(),
    },
  });

  void recordUsageEvent({ tenantId, eventType: "AGENT_RUN" as UsageEventType });

  return { runId: run.id };
}

export async function finishAgentRunSuccess({
  runId,
  output,
  tokensPrompt,
  tokensCompletion,
  durationMs,
  retryCount,
  retryPayload,
}: {
  runId: string;
  output?: unknown;
  tokensPrompt?: number;
  tokensCompletion?: number;
  durationMs?: number;
  retryCount?: number;
  retryPayload?: unknown;
}) {
  const normalizedOutput = normalizeJsonValue(output);

  await prisma.agentRunLog.update({
    where: { id: runId },
    data: {
      status: AgentRunStatus.SUCCESS,
      output: normalizedOutput,
      outputSnapshot: normalizedOutput,
      errorMessage: null,
      tokensPrompt,
      tokensCompletion,
      durationMs,
      retryCount,
      retryPayload: normalizeJsonValue(retryPayload),
      finishedAt: new Date(),
    },
  });
}

export async function finishAgentRunError({
  runId,
  errorMessage,
  durationMs,
  retryCount,
  retryPayload,
}: {
  runId: string;
  errorMessage?: string;
  durationMs?: number;
  retryCount?: number;
  retryPayload?: unknown;
}) {
  await prisma.agentRunLog.update({
    where: { id: runId },
    data: {
      status: AgentRunStatus.FAILED,
      errorMessage,
      durationMs,
      retryCount,
      retryPayload: normalizeJsonValue(retryPayload),
      finishedAt: new Date(),
    },
  });
}
