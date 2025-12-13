import type { MappedJob, MappedCandidate, MappedPlacement, SyncSummary, SyncStore } from './types';

type SyncAttemptHandle = { attemptId: string; startedAt: number };

export interface SyncLogger {
  start(context: { tenantId: string; provider: string }): Promise<SyncAttemptHandle>;
  recordFailure(params: {
    attemptId: string;
    error: unknown;
    retryCount: number;
    nextAttemptAt?: Date | null;
  }): Promise<void>;
  recordSuccess(params: {
    attemptId: string;
    summary: SyncSummary;
    retryCount: number;
    durationMs: number;
  }): Promise<void>;
}

export interface SyncDependencies {
  fetchJobs: () => Promise<MappedJob[]>;
  fetchCandidates: () => Promise<MappedCandidate[]>;
  fetchPlacements: () => Promise<MappedPlacement[]>;
  store: SyncStore;
  tenantId?: string;
  provider?: string;
  logger?: SyncLogger;
  retryDelaysMs?: number[];
}

export async function syncBullhorn({
  fetchJobs,
  fetchCandidates,
  fetchPlacements,
  store,
  tenantId = 'default-tenant',
  provider = 'bullhorn',
  logger,
  retryDelaysMs = [0, 750, 2000],
}: SyncDependencies): Promise<SyncSummary> {
  const handle = logger ? await logger.start({ tenantId, provider }) : null;
  let lastError: unknown;

  for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
    const delay = retryDelaysMs[attempt];
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      const [jobs, candidates, placements] = await Promise.all([
        fetchJobs(),
        fetchCandidates(),
        fetchPlacements(),
      ]);

      await Promise.all([
        store.upsertJobs(jobs),
        store.upsertCandidates(candidates),
        store.upsertPlacements(placements),
      ]);

      const summary: SyncSummary = {
        jobsSynced: jobs.length,
        candidatesSynced: candidates.length,
        placementsSynced: placements.length,
      };

      if (handle && logger) {
        const durationMs = Date.now() - handle.startedAt;
        await logger.recordSuccess({ attemptId: handle.attemptId, summary, retryCount: attempt, durationMs });
      }

      return summary;
    } catch (error) {
      lastError = error;
      const nextDelay = retryDelaysMs[attempt + 1];
      const nextAttemptAt = typeof nextDelay === 'number' ? new Date(Date.now() + nextDelay) : null;

      if (handle && logger) {
        await logger.recordFailure({
          attemptId: handle.attemptId,
          error,
          retryCount: attempt,
          nextAttemptAt,
        });
      }
    }
  }

  throw new Error(`Bullhorn sync failed after retries: ${lastError instanceof Error ? lastError.message : 'unknown error'}`);
}

export class InMemorySyncStore implements SyncStore {
  readonly jobs = new Map<string, MappedJob>();
  readonly candidates = new Map<string, MappedCandidate>();
  readonly placements = new Map<string, MappedPlacement>();

  async upsertJobs(jobs: MappedJob[]): Promise<void> {
    for (const job of jobs) {
      this.jobs.set(job.id, job);
    }
  }

  async upsertCandidates(candidates: MappedCandidate[]): Promise<void> {
    for (const candidate of candidates) {
      this.candidates.set(candidate.id, candidate);
    }
  }

  async upsertPlacements(placements: MappedPlacement[]): Promise<void> {
    for (const placement of placements) {
      this.placements.set(placement.id, placement);
    }
  }
}

type InMemoryAttemptStatus = 'running' | 'success' | 'failed';

export class InMemorySyncLogger implements SyncLogger {
  readonly attempts: Array<{
    id: string;
    status: InMemoryAttemptStatus;
    retryCount: number;
    errorMessage?: string | null;
    nextAttemptAt?: Date | null;
    summary?: SyncSummary;
    durationMs?: number;
  }> = [];

  async start(_context: { tenantId: string; provider: string }): Promise<SyncAttemptHandle> {
    const id = `attempt-${this.attempts.length + 1}`;
    this.attempts.push({ id, status: 'running', retryCount: 0 });
    return { attemptId: id, startedAt: Date.now() };
  }

  async recordFailure({ attemptId, error, retryCount, nextAttemptAt }: {
    attemptId: string;
    error: unknown;
    retryCount: number;
    nextAttemptAt?: Date | null;
  }): Promise<void> {
    const attempt = this.attempts.find((entry) => entry.id === attemptId);
    if (!attempt) return;

    attempt.status = 'failed';
    attempt.retryCount = retryCount;
    attempt.errorMessage = error instanceof Error ? error.message : String(error);
    attempt.nextAttemptAt = nextAttemptAt ?? null;
  }

  async recordSuccess({ attemptId, summary, retryCount, durationMs }: {
    attemptId: string;
    summary: SyncSummary;
    retryCount: number;
    durationMs: number;
  }): Promise<void> {
    const attempt = this.attempts.find((entry) => entry.id === attemptId);
    if (!attempt) return;

    attempt.status = 'success';
    attempt.summary = summary;
    attempt.retryCount = retryCount;
    attempt.durationMs = durationMs;
    attempt.errorMessage = null;
    attempt.nextAttemptAt = null;
  }
}
