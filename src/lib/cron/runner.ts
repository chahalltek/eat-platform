import { AgentRunStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { logRetentionJobRun } from "@/lib/audit/securityEvents";
import {
  ensureJobState,
  isInBackoff,
  markJobFailure,
  markJobStarted,
  markJobSuccess,
} from "./jobState";

import { cronJobs } from "./jobs";

type AgentRunLogResult<T> = {
  result: T;
  logId: string;
};

type AgentRunLogOptions<T> = {
  agentName: string;
  userId?: string;
  input?: unknown;
  run: () => Promise<T>;
};

export async function withAgentRunLog<T>({
  agentName,
  userId,
  input,
  run,
}: AgentRunLogOptions<T>): Promise<AgentRunLogResult<T>> {
  const normalizedInput = (input ?? {}) as Prisma.InputJsonValue;
  const startedAt = Date.now();

  const runLog = await prisma.agentRunLog.create({
    data: {
      agentName,
      userId,
      input: normalizedInput,
      inputSnapshot: normalizedInput,
    },
  });

  try {
    const result = await run();
    const normalizedOutput = (result ?? {}) as Prisma.InputJsonValue;
    const durationMs = Date.now() - startedAt;

    await prisma.agentRunLog.update({
      where: { id: runLog.id },
      data: {
        status: AgentRunStatus.SUCCESS,
        output: normalizedOutput,
        outputSnapshot: normalizedOutput,
        durationMs,
        finishedAt: new Date(),
      },
    });

    return { result, logId: runLog.id };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await prisma.agentRunLog.update({
      where: { id: runLog.id },
      data: {
        status: AgentRunStatus.FAILED,
        errorMessage,
        durationMs,
        finishedAt: new Date(),
      },
    });

    throw error;
  }
}

export async function runCronJob(jobName: string) {
  const job = cronJobs[jobName];

  if (!job) {
    throw new Error(`Cron job '${jobName}' is not registered`);
  }

  const now = new Date();
  const currentState = await ensureJobState(jobName, job.jobType);

  if (isInBackoff(currentState, now)) {
    return {
      jobName,
      skipped: true,
      state: currentState,
      message: `Job is in backoff until ${currentState.nextRunAt?.toISOString()}`,
    } as const;
  }

  const runningState = await markJobStarted(jobName, job.jobType, now);

  try {
    const { result, logId } = await withAgentRunLog({
      agentName: `CRON.${jobName.replace(/-/g, "_").toUpperCase()}`,
      input: { jobName },
      run: () => job.run(),
    });

    const successState = await markJobSuccess(jobName, job.jobType, new Date());

    if (/retention|deletion/i.test(jobName)) {
      await logRetentionJobRun({
        jobName,
        details: result.details,
      });
    }

    return { jobName, logId, result, state: successState };
  } catch (error) {
    const failedState = await markJobFailure(jobName, job.jobType, error, runningState, new Date());
    const message = error instanceof Error ? error.message : String(error);

    throw Object.assign(new Error(`Cron job '${jobName}' failed: ${message}`), {
      jobState: failedState,
    });
  }
}

export function listCronJobs() {
  return Object.keys(cronJobs);
}
