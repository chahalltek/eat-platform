import type { Prisma, PrismaClient } from '@prisma/client';

export type PipelineRunStatus = 'success' | 'failed' | 'skipped';

export type PipelineRunInput = {
  jobId?: string | null;
  candidatesInput?: Prisma.InputJsonValue | null;
  promptContext?: Prisma.InputJsonValue | null;
  mode?: string | null;
};

export type PipelineRunResult<T extends Prisma.InputJsonValue = Prisma.InputJsonValue> = {
  results?: T | null;
  matchesReturned?: number;
  shortlistCount?: number;
  outreachCount?: number;
  candidateCount?: number;
  outreachInteractions?: Prisma.InputJsonValue | null;
  mode?: string | null;
  tenantId?: string | null;
  tokenUsage?: { promptTokens?: number; completionTokens?: number } | null;
};

export type PipelineRunOptions = {
  agentName: string;
  tenantId: string;
  requestedBy?: string | null;
  jobId?: string | null;
  mode?: string | null;
  promptMeta?: Prisma.InputJsonValue | null;
  input?: PipelineRunInput | null;
  skipReason?: string | null;
};

type PipelineRunClient = Pick<PrismaClient, 'agentRun'>;

function buildInputPayload({ jobId, input, mode }: PipelineRunOptions) {
  return {
    jobId: input?.jobId ?? jobId ?? null,
    candidatesInput: input?.candidatesInput ?? null,
    promptContext: input?.promptContext ?? null,
    mode: input?.mode ?? mode ?? null,
  } satisfies Record<string, unknown>;
}

function buildSuccessOutput<T extends Prisma.InputJsonValue>(
  options: PipelineRunOptions,
  result: PipelineRunResult<T>,
) {
  return {
    results: result.results ?? null,
    matchesReturned: result.matchesReturned ?? null,
    shortlistCount: result.shortlistCount ?? null,
    outreachCount: result.outreachCount ?? null,
    candidateCount: result.candidateCount ?? null,
    outreachInteractions: result.outreachInteractions ?? null,
    mode: result.mode ?? options.mode ?? options.input?.mode ?? null,
    tenantId: result.tenantId ?? options.tenantId ?? null,
    tokens: result.tokenUsage ?? null,
  } satisfies Record<string, unknown>;
}

function buildFailureOutput(options: PipelineRunOptions, error: unknown) {
  const normalized = error instanceof Error ? error : new Error(String(error));

  return {
    error: normalized.message,
    stack: normalized.stack ?? null,
    mode: options.mode ?? options.input?.mode ?? null,
    tenantId: options.tenantId ?? null,
  } satisfies Record<string, unknown>;
}

function buildSkipOutput(options: PipelineRunOptions, reason: string) {
  return {
    skipReason: reason,
    mode: options.mode ?? options.input?.mode ?? null,
    tenantId: options.tenantId ?? null,
  } satisfies Record<string, unknown>;
}

export async function runPipelineStep<T extends Prisma.InputJsonValue = Prisma.InputJsonValue>(
  prisma: PipelineRunClient,
  options: PipelineRunOptions,
  handler: () => Promise<PipelineRunResult<T>>,
): Promise<{ runId: string; status: PipelineRunStatus; result?: PipelineRunResult<T> }> {
  const startedAt = new Date();
  const inputPayload = buildInputPayload(options);

  const run = await prisma.agentRun.create({
    data: {
      agentName: options.agentName,
      tenantId: options.tenantId,
      requestedBy: options.requestedBy ?? null,
      jobId: options.jobId ?? options.input?.jobId ?? null,
      mode: options.mode ?? options.input?.mode ?? null,
      status: 'running',
      promptMeta: options.promptMeta ?? null,
      input: inputPayload,
      startedAt,
    },
  });

  if (options.skipReason) {
    const finishedAt = new Date();
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'skipped',
        output: buildSkipOutput(options, options.skipReason),
        finishedAt,
      },
    });

    return { runId: run.id, status: 'skipped' } as const;
  }

  try {
    const result = await handler();
    const finishedAt = new Date();

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'success',
        output: buildSuccessOutput(options, result),
        finishedAt,
      },
    });

    return { runId: run.id, status: 'success', result };
  } catch (error) {
    const finishedAt = new Date();

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        output: buildFailureOutput(options, error),
        finishedAt,
      },
    });

    throw error;
  }
}
