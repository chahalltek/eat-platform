import type { AsyncJobState } from "@/server/db/prisma";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  computeBackoffDelayMs,
  ensureJobState,
  isInBackoff,
  markJobFailure,
  markJobStarted,
  markJobSuccess,
} from "./jobState";

const { mockFindUnique, mockCreate, mockUpsert, mockUpdate } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
  mockUpsert: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    asyncJobState: {
      findUnique: mockFindUnique,
      create: mockCreate,
      upsert: mockUpsert,
      update: mockUpdate,
    },
  },
}));

function buildState(overrides: Partial<AsyncJobState> = {}): AsyncJobState {
  const now = new Date();
  return {
    id: "job-1",
    jobName: "learning-aggregate",
    jobType: "aggregation",
    status: "idle",
    retries: 0,
    lastError: null,
    lastRunAt: null,
    nextRunAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } satisfies AsyncJobState;
}

describe("cron job state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses exponential backoff with an upper bound", () => {
    expect(computeBackoffDelayMs(1)).toBe(60_000);
    expect(computeBackoffDelayMs(2)).toBe(120_000);
    expect(computeBackoffDelayMs(3)).toBe(240_000);
    expect(computeBackoffDelayMs(6)).toBe(1_920_000);
    expect(computeBackoffDelayMs(8)).toBe(3_600_000);
    expect(computeBackoffDelayMs(10)).toBe(3_600_000);
  });

  it("creates an initial state when none exists", async () => {
    const created = buildState();
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(created);

    const state = await ensureJobState("learning-aggregate", "aggregation");

    expect(state).toBe(created);
    expect(mockCreate).toHaveBeenCalledWith({
      data: { jobName: "learning-aggregate", jobType: "aggregation", status: "idle", retries: 0 },
    });
  });

  it("marks a job as running and clears errors", async () => {
    const now = new Date("2024-01-01T00:00:00.000Z");
    const running = buildState({ status: "running", lastError: null, lastRunAt: now });
    mockUpsert.mockResolvedValue(running);

    const state = await markJobStarted("learning-aggregate", "aggregation", now);

    expect(state.status).toBe("running");
    expect(state.lastError).toBeNull();
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { jobName: "learning-aggregate" },
      create: expect.objectContaining({ status: "running", lastRunAt: now, retries: 0 }),
      update: expect.objectContaining({ status: "running", lastRunAt: now }),
    });
  });

  it("increments retries and schedules the next run on failure", async () => {
    const now = new Date("2024-01-01T00:00:00.000Z");
    const previousState = buildState({ status: "failed", retries: 1 });
    const failedState = buildState({
      status: "failed",
      retries: 2,
      nextRunAt: new Date(now.getTime() + 120_000),
      lastError: "boom",
      lastRunAt: now,
    });
    mockUpdate.mockResolvedValue(failedState);

    const state = await markJobFailure("learning-aggregate", "aggregation", new Error("boom"), previousState, now);

    expect(state.retries).toBe(2);
    expect(state.nextRunAt?.getTime()).toBe(now.getTime() + 120_000);
    expect(state.lastError).toBe("boom");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { jobName: "learning-aggregate" },
      data: expect.objectContaining({ status: "failed", retries: 2, lastError: "boom" }),
    });
  });

  it("resets retries after a successful run", async () => {
    const now = new Date("2024-01-02T00:00:00.000Z");
    const successState = buildState({ status: "success", retries: 0, lastRunAt: now });
    mockUpsert.mockResolvedValue(successState);

    const state = await markJobSuccess("learning-aggregate", "aggregation", now);

    expect(state.status).toBe("success");
    expect(state.retries).toBe(0);
    expect(state.nextRunAt).toBeNull();
  });

  it("identifies when a job is in backoff", () => {
    const future = new Date(Date.now() + 5 * 60_000);
    const state = buildState({ nextRunAt: future });

    expect(isInBackoff(state, new Date())).toBe(true);
    expect(isInBackoff(buildState({ nextRunAt: null }), new Date())).toBe(false);
  });
});
