import { finishAgentRunError, finishAgentRunSuccess, startAgentRun } from '@/lib/agentRunLog';

import type { SyncLogger } from './sync';
import type { SyncSummary } from './types';

const AGENT_PREFIX = 'ATS_SYNC';

type RetryPayload = { nextAttemptAt?: string } | null;

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

function buildRetryPayload(nextAttemptAt?: Date | null): RetryPayload {
  if (!nextAttemptAt) return null;
  return { nextAttemptAt: nextAttemptAt.toISOString() };
}

export function createBullhornSyncLogger({ tenantId, provider = 'bullhorn' }: { tenantId: string; provider?: string }): SyncLogger {
  return {
    async start() {
      const { runId } = await startAgentRun({
        agentName: `${AGENT_PREFIX}.${provider.toUpperCase()}`,
        tenantId,
        input: { provider },
      });

      return { attemptId: runId, startedAt: Date.now() };
    },

    async recordFailure({ attemptId, error, retryCount, nextAttemptAt }) {
      await finishAgentRunError({
        runId: attemptId,
        errorMessage: normalizeError(error),
        retryCount,
        retryPayload: buildRetryPayload(nextAttemptAt),
      });
    },

    async recordSuccess({ attemptId, summary, retryCount, durationMs }) {
      await finishAgentRunSuccess({
        runId: attemptId,
        output: summary satisfies SyncSummary,
        retryCount,
        retryPayload: null,
        durationMs,
      });
    },
  };
}

export type AtsRetryMetadata = RetryPayload;
