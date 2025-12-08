// src/lib/agents/agentRun.ts
import { Prisma } from '@prisma/client';

import { DEFAULT_TENANT_ID } from '@/lib/auth/config';
import { assertAgentKillSwitchDisarmed, type AgentName } from '@/lib/agents/killSwitch';
import { assertKillSwitchDisarmed, KILL_SWITCHES } from '@/lib/killSwitch';
import { prisma } from '@/lib/prisma';
import { assertTenantWithinLimits } from '@/lib/subscription/usageLimits';

type AgentRunInput = {
  agentName: AgentName;
  recruiterId?: string;
  inputSnapshot: Prisma.InputJsonValue | Prisma.JsonNullValueInput;
  sourceType?: string | null;
  sourceTag?: string | null;
  retryCount?: number;
  retryOfId?: string;
};

export type AgentRetryMetadata = Pick<AgentRunInput, 'retryCount' | 'retryOfId'>;

async function validateRecruiter(recruiterId: string): Promise<{ id: string; tenantId: string }> {
  const user = await prisma.user.findUnique({
    where: { id: recruiterId },
    select: { id: true, tenantId: true },
  });

  if (!user) {
    throw new Error('User not found for recruiterId');
  }

  return user;
}

type AgentRunResult<T extends Prisma.InputJsonValue> =
  | { result: T; outputSnapshot?: Prisma.InputJsonValue | Prisma.JsonNullValueInput }
  | T;

function isStructuredResult<T extends Prisma.InputJsonValue>(
  value: AgentRunResult<T>,
): value is { result: T; outputSnapshot?: Prisma.InputJsonValue | Prisma.JsonNullValueInput } {
  return typeof value === 'object' && value !== null && 'result' in value;
}

export async function withAgentRun<T extends Prisma.InputJsonValue>(
  {
    agentName,
    recruiterId,
    inputSnapshot,
    sourceType,
    sourceTag,
    retryCount,
    retryOfId,
  }: AgentRunInput,
  fn: () => Promise<AgentRunResult<T>>,
): Promise<[T, string]> {
  assertKillSwitchDisarmed(KILL_SWITCHES.AGENTS, { componentName: agentName });
  await assertAgentKillSwitchDisarmed(agentName);

  const startedAt = new Date();

  const user = recruiterId != null ? await validateRecruiter(recruiterId) : null;
  const tenantId = user?.tenantId ?? DEFAULT_TENANT_ID;

  await assertTenantWithinLimits(tenantId, 'createAgentRun');

  const agentRun = await prisma.agentRunLog.create({
    data: {
      agentName,
      tenantId,
      userId: user?.id,
      sourceType: sourceType ?? null,
      sourceTag: sourceTag ?? null,
      input: inputSnapshot,
      inputSnapshot,
      status: 'RUNNING',
      startedAt,
      retryCount: retryCount ?? 0,
      retryOfId: retryOfId ?? null,
    },
  });

  try {
    const fnResult = await fn();
    
    let result: T;
    let outputSnapshot: Prisma.InputJsonValue | Prisma.JsonNullValueInput | undefined;

    if (isStructuredResult(fnResult)) {
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
   
    const outputSnapshotValue: Prisma.InputJsonValue = normalizedOutputSnapshot ?? result;

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
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
        finishedAt,
      },
    });

    throw err;
  }
}
