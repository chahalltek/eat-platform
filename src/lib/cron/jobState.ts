import type { AsyncJobState } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AsyncJobStatus = "idle" | "running" | "success" | "failed";

const BASE_BACKOFF_MS = 60_000; // 1 minute
const MAX_BACKOFF_MS = 60 * 60_000; // 1 hour
const MAX_RETRIES = 5;

export function computeBackoffDelayMs(retries: number) {
  const attempt = Math.max(1, retries);
  const delay = BASE_BACKOFF_MS * 2 ** (attempt - 1);

  return Math.min(delay, MAX_BACKOFF_MS);
}

export async function ensureJobState(jobName: string, jobType: string) {
  const existing = await prisma.asyncJobState.findUnique({ where: { jobName } });

  if (existing) return existing;

  return prisma.asyncJobState.create({
    data: { jobName, jobType, status: "idle", retries: 0 },
  });
}

export function isInBackoff(state: AsyncJobState, now = new Date()) {
  if (!state.nextRunAt) return false;

  return state.nextRunAt.getTime() > now.getTime();
}

export async function markJobStarted(jobName: string, jobType: string, now = new Date()) {
  return prisma.asyncJobState.upsert({
    where: { jobName },
    create: {
      jobName,
      jobType,
      status: "running",
      retries: 0,
      lastRunAt: now,
      lastError: null,
      nextRunAt: null,
    },
    update: {
      jobType,
      status: "running",
      lastRunAt: now,
      lastError: null,
      nextRunAt: null,
    },
  });
}

export async function markJobSuccess(jobName: string, jobType: string, now = new Date()) {
  return prisma.asyncJobState.upsert({
    where: { jobName },
    create: {
      jobName,
      jobType,
      status: "success",
      retries: 0,
      lastRunAt: now,
      nextRunAt: null,
      lastError: null,
    },
    update: {
      jobType,
      status: "success",
      retries: 0,
      lastRunAt: now,
      nextRunAt: null,
      lastError: null,
    },
  });
}

export async function markJobFailure(
  jobName: string,
  jobType: string,
  error: unknown,
  previousState?: AsyncJobState,
  now = new Date(),
) {
  const state = previousState ?? (await ensureJobState(jobName, jobType));
  const retries = Math.min(state.retries + 1, MAX_RETRIES);
  const backoffMs = computeBackoffDelayMs(retries);
  const nextRunAt = new Date(now.getTime() + backoffMs);
  const errorMessage = error instanceof Error ? error.message : String(error);

  return prisma.asyncJobState.update({
    where: { jobName },
    data: {
      jobType,
      status: "failed",
      retries,
      lastError: errorMessage,
      lastRunAt: now,
      nextRunAt,
    },
  });
}
