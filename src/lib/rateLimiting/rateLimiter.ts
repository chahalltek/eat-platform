import { DEFAULT_USER_ID } from '@/lib/auth/config';

export type RateLimitScope = 'api' | 'llm';

type RateLimitReason = 'daily' | 'burst';

type RateLimitConfig = {
  dailyLimit: number;
  burstLimit: number;
  burstWindowMs: number;
};

type RateLimitSnapshot = {
  dailyCount: number;
  dailyResetAt: number;
  burstTimestamps: number[];
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_CONFIG: Record<RateLimitScope, RateLimitConfig> = {
  api: {
    dailyLimit: Number(process.env.RATE_LIMIT_API_DAILY ?? 5_000),
    burstLimit: Number(process.env.RATE_LIMIT_API_BURST ?? 50),
    burstWindowMs: Number(process.env.RATE_LIMIT_API_WINDOW_MS ?? 60_000),
  },
  llm: {
    dailyLimit: Number(process.env.RATE_LIMIT_LLM_DAILY ?? 1_000),
    burstLimit: Number(process.env.RATE_LIMIT_LLM_BURST ?? 15),
    burstWindowMs: Number(process.env.RATE_LIMIT_LLM_WINDOW_MS ?? 60_000),
  },
};

export class RateLimitError extends Error {
  constructor(
    message: string,
    public scope: RateLimitScope,
    public reason: RateLimitReason,
    public retryAfterMs: number,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class RateLimiter {
  private snapshots: Record<RateLimitScope, Map<string, RateLimitSnapshot>> = {
    api: new Map(),
    llm: new Map(),
  };

  constructor(
    private config: Record<RateLimitScope, RateLimitConfig> = DEFAULT_CONFIG,
    private clock: () => number = Date.now,
  ) {}

  consume(userId: string | null | undefined, scope: RateLimitScope) {
    const resolvedUserId = userId || DEFAULT_USER_ID;
    const now = this.clock();
    const { dailyLimit, burstLimit, burstWindowMs } = this.config[scope];

    const userSnapshot = this.getSnapshot(scope, resolvedUserId, now);

    userSnapshot.burstTimestamps = userSnapshot.burstTimestamps.filter(
      (timestamp) => now - timestamp < burstWindowMs,
    );

    if (userSnapshot.dailyCount >= dailyLimit) {
      throw new RateLimitError(
        'Daily request limit reached',
        scope,
        'daily',
        userSnapshot.dailyResetAt - now,
      );
    }

    if (userSnapshot.burstTimestamps.length >= burstLimit) {
      const oldestTimestamp = userSnapshot.burstTimestamps[0];
      const retryAfterMs = Math.max(0, burstWindowMs - (now - oldestTimestamp));

      throw new RateLimitError(
        'Too many requests. Please slow down.',
        scope,
        'burst',
        retryAfterMs,
      );
    }

    userSnapshot.dailyCount += 1;
    userSnapshot.burstTimestamps.push(now);

    this.snapshots[scope].set(resolvedUserId, userSnapshot);

    return {
      remainingDaily: Math.max(0, dailyLimit - userSnapshot.dailyCount),
      remainingBurst: Math.max(0, burstLimit - userSnapshot.burstTimestamps.length),
      dailyResetAt: userSnapshot.dailyResetAt,
    };
  }

  resetAll() {
    this.snapshots.api.clear();
    this.snapshots.llm.clear();
  }

  private getSnapshot(scope: RateLimitScope, userId: string, now: number) {
    const existing = this.snapshots[scope].get(userId);

    if (!existing) {
      return {
        dailyCount: 0,
        dailyResetAt: now + ONE_DAY_MS,
        burstTimestamps: [],
      } satisfies RateLimitSnapshot;
    }

    if (now >= existing.dailyResetAt) {
      return {
        dailyCount: 0,
        dailyResetAt: now + ONE_DAY_MS,
        burstTimestamps: [],
      } satisfies RateLimitSnapshot;
    }

    return existing;
  }
}

const globalRateLimiter = (() => {
  const globalObj = globalThis as typeof globalThis & {
    __EAT_RATE_LIMITER?: RateLimiter;
  };

  if (!globalObj.__EAT_RATE_LIMITER) {
    globalObj.__EAT_RATE_LIMITER = new RateLimiter();
  }

  return globalObj.__EAT_RATE_LIMITER;
})();

export function consumeRateLimit(userId: string | null | undefined, scope: RateLimitScope) {
  return globalRateLimiter.consume(userId, scope);
}

export function resetRateLimiter() {
  globalRateLimiter.resetAll();
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}
