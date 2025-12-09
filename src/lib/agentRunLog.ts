import { AgentRunStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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

  return { runId: run.id };
}

export async function finishAgentRunSuccess({
  runId,
  output,
  tokensPrompt,
  tokensCompletion,
  durationMs,
}: {
  runId: string;
  output?: unknown;
  tokensPrompt?: number;
  tokensCompletion?: number;
  durationMs?: number;
}) {
  const normalizedOutput = normalizeJsonValue(output);

  await prisma.agentRunLog.update({
    where: { id: runId },
    data: {
      status: AgentRunStatus.SUCCESS,
      output: normalizedOutput,
      outputSnapshot: normalizedOutput,
      tokensPrompt,
      tokensCompletion,
      durationMs,
      finishedAt: new Date(),
    },
  });
}

export async function finishAgentRunError({
  runId,
  errorMessage,
  durationMs,
}: {
  runId: string;
  errorMessage?: string;
  durationMs?: number;
}) {
  await prisma.agentRunLog.update({
    where: { id: runId },
    data: {
      status: AgentRunStatus.FAILED,
      errorMessage,
      durationMs,
      finishedAt: new Date(),
    },
  });
}
