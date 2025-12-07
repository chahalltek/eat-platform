// src/lib/agents/agentRun.ts
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

type AgentRunInput = {
  agentName: string;
  recruiterId?: string;
  inputSnapshot: Prisma.InputJsonValue | Prisma.JsonNullValueInput;
};

type AgentRunResult<T extends Prisma.InputJsonValue> =
  | { result: T; outputSnapshot?: Prisma.InputJsonValue | Prisma.JsonNullValueInput }
  | T;

function isStructuredResult<T extends Prisma.InputJsonValue>(
  value: AgentRunResult<T>,
): value is { result: T; outputSnapshot?: Prisma.InputJsonValue | Prisma.JsonNullValueInput } {
  return typeof value === 'object' && value !== null && 'result' in value;
}

export async function withAgentRun<T extends Prisma.InputJsonValue>(
  { agentName, recruiterId, inputSnapshot }: AgentRunInput,
  fn: () => Promise<AgentRunResult<T>>,
): Promise<[T, string]> {
  const startedAt = new Date();

  const agentRun = await prisma.agentRunLog.create({
    data: {
      agentName,
      userId: recruiterId ?? null,
      input: inputSnapshot,
      inputSnapshot,
      status: 'RUNNING',
      startedAt,
    },
  });

  try {
    const fnResult = await fn();
    const { result, outputSnapshot } = isStructuredResult<T>(fnResult)
      ? fnResult
      : { result: fnResult };

    const normalizedOutputSnapshot =
      outputSnapshot === Prisma.JsonNull ? null : outputSnapshot;
    const outputSnapshotValue = normalizedOutputSnapshot ?? result;

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    const updatedRun = await prisma.agentRunLog.update({
      where: { id: agentRun.id },
      data: {
        output: { snapshot: outputSnapshotValue, durationMs },
        outputSnapshot: outputSnapshotValue,
        durationMs,
        status: 'SUCCESS',
        finishedAt,
      },
    });

    return [result, updatedRun.id];
  } catch (err) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    await prisma.agentRunLog.update({
      where: { id: agentRun.id },
      data: {
        output: { durationMs },
        durationMs,
        status: 'ERROR',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
        finishedAt,
      },
    });

    throw err;
  }
}
