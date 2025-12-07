// src/lib/agents/agentRun.ts
import { prisma } from '@/lib/prisma';

type AgentRunInput = {
  agentName: string;
  recruiterId?: string;
  inputSnapshot: unknown;
};

type AgentRunResult<T> = { result: T; outputSnapshot?: unknown } | T;

function isStructuredResult<T>(value: AgentRunResult<T>): value is { result: T; outputSnapshot?: unknown } {
  return typeof value === 'object' && value !== null && 'result' in value;
}

export async function withAgentRun<T>(
  { agentName, recruiterId, inputSnapshot }: AgentRunInput,
  fn: () => Promise<AgentRunResult<T>>,
): Promise<[T, string]> {
  const startedAt = new Date();

  const agentRun = await prisma.agentRunLog.create({
    data: {
      agentName,
      userId: recruiterId ?? null,
      input: inputSnapshot,
      status: 'RUNNING',
      startedAt,
    },
  });

  try {
    const fnResult = await fn();
    const { result, outputSnapshot } = isStructuredResult<T>(fnResult)
      ? fnResult
      : { result: fnResult };

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    const updatedRun = await prisma.agentRunLog.update({
      where: { id: agentRun.id },
      data: {
        output: { snapshot: outputSnapshot ?? result, durationMs },
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
        status: 'ERROR',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
        finishedAt,
      },
    });

    throw err;
  }
}
