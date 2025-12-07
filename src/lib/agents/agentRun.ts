// src/lib/agents/agentRun.ts
<<<<<<< ours
import { Prisma } from '@prisma/client';

=======
>>>>>>> theirs
import { prisma } from '@/lib/prisma';

type AgentRunInput = {
  agentName: string;
  recruiterId?: string;
<<<<<<< ours
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
=======
  inputSnapshot: unknown;
};

type AgentRunResult<T> = { result: T; outputSnapshot?: unknown } | T;

function isStructuredResult<T>(value: AgentRunResult<T>): value is { result: T; outputSnapshot?: unknown } {
  return typeof value === 'object' && value !== null && 'result' in value;
}

export async function withAgentRun<T>(
>>>>>>> theirs
  { agentName, recruiterId, inputSnapshot }: AgentRunInput,
  fn: () => Promise<AgentRunResult<T>>,
): Promise<[T, string]> {
  const startedAt = new Date();

<<<<<<< ours
  const agentRun = await prisma.agentRunLog.create({
    data: {
      agentName,
      userId: recruiterId ?? null,
      input: inputSnapshot,
      inputSnapshot,
=======
  const userId = recruiterId
    ? (await prisma.user.findUnique({ where: { id: recruiterId }, select: { id: true } }))?.id ?? null
    : null;

  const agentRun = await prisma.agentRunLog.create({
    data: {
      agentName,
      userId,
      input: inputSnapshot,
>>>>>>> theirs
      status: 'RUNNING',
      startedAt,
    },
  });

  try {
    const fnResult = await fn();
<<<<<<< ours
    
    let result: T;
    let outputSnapshot: Prisma.InputJsonValue | Prisma.JsonNullValueInput | undefined;

    if (isStructuredResult<T>(fnResult)) {
      result = fnResult.result;
      outputSnapshot = fnResult.outputSnapshot;
    } else {
      result = fnResult;
      outputSnapshot = undefined;
    }

    const normalizedOutputSnapshot: Prisma.InputJsonValue | null = (() => {
      if (outputSnapshot === undefined || outputSnapshot === null) return null;
      if (outputSnapshot === Prisma.JsonNull) return null;
      return outputSnapshot as Prisma.InputJsonValue;
    })();
    const outputSnapshotValue: Prisma.InputJsonValue =
      normalizedOutputSnapshot ?? result;
=======
    const { result, outputSnapshot } = isStructuredResult<T>(fnResult)
      ? fnResult
      : { result: fnResult };
>>>>>>> theirs

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    const updatedRun = await prisma.agentRunLog.update({
      where: { id: agentRun.id },
      data: {
<<<<<<< ours
        output: { snapshot: outputSnapshotValue, durationMs },
        outputSnapshot: outputSnapshotValue,
        durationMs,
=======
        output: { snapshot: outputSnapshot ?? result, durationMs },
>>>>>>> theirs
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
<<<<<<< ours
        durationMs,
=======
>>>>>>> theirs
        status: 'ERROR',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
        finishedAt,
      },
    });

    throw err;
  }
}
