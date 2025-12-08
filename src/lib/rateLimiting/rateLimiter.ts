import type { SubscriptionPlan } from '@prisma/client';

import { DEFAULT_TENANT_ID, DEFAULT_USER_ID } from '@/lib/auth/config';
import { getTenantPlan } from '@/lib/subscriptionPlans';
import { logRateLimitThreshold } from '@/lib/audit/securityEvents';

export const RATE_LIMIT_ACTIONS = {
  API: 'api',
  LLM: 'llm',
  AGENT_RUN: 'agentRun',
  OUTREACH: 'outreach',
} as const;

export type RateLimitAction = (typeof RATE_LIMIT_ACTIONS)[keyof typeof RATE_LIMIT_ACTIONS];

type RateLimitReason = 'daily' | 'burst';

export type RateLimitConfig = {
  dailyLimit?: number;
  burstLimit?: number;
  burstWindowMs: number;
  bucket: 'tenant' | 'user';
};

type RateLimitPlanOverrides = Partial<Pick<RateLimitConfig, 'dailyLimit' | 'burstLimit' | 'burstWindowMs'>> & {
  bucket?: RateLimitConfig['bucket'];
};

type RateLimitSnapshot = {
  dailyCount: number;
  dailyResetAt: number;
  burstTimestamps: number[];
};

export type RateLimitContext = {
  tenantId: string | null | undefined;
  userId: string | null | undefined;
  action: RateLimitAction;
};

export type RateLimitResult = {
  remainingDaily: number | null;
  remainingBurst: number | null;
  dailyResetAt: number | null;
};

type PlanResolver = (tenantId: string) => Promise<SubscriptionPlan | null>;
type SecurityLogger = (entry: RateLimitLogEntry) => Promise<void> | void;

export type RateLimitLogEntry = {
  tenantId: string;
  userId: string | null;
  action: RateLimitAction;
  reason: RateLimitReason;
  limit: number | undefined;
  retryAfterMs: number;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const LOG_THRESHOLD = 3;
const LOG_WINDOW_MS = 15 * 60 * 1000;

const DEFAULT_CONFIG: Record<RateLimitAction, RateLimitConfig> = {
  api: {
    dailyLimit: Number(process.env.RATE_LIMIT_API_DAILY ?? 5_000),
    burstLimit: Number(process.env.RATE_LIMIT_API_BURST ?? 50),
    burstWindowMs: Number(process.env.RATE_LIMIT_API_WINDOW_MS ?? 60_000),
    bucket: 'tenant',
  },
  llm: {
    dailyLimit: Number(process.env.RATE_LIMIT_LLM_DAILY ?? 1_000),
    burstLimit: Number(process.env.RATE_LIMIT_LLM_BURST ?? 15),
    burstWindowMs: Number(process.env.RATE_LIMIT_LLM_WINDOW_MS ?? 60_000),
    bucket: 'user',
  },
  agentRun: {
    dailyLimit: Number(process.env.RATE_LIMIT_AGENT_RUN_DAILY ?? 2_500),
    burstLimit: Number(process.env.RATE_LIMIT_AGENT_RUN_BURST ?? 30),
    burstWindowMs: Number(process.env.RATE_LIMIT_AGENT_RUN_WINDOW_MS ?? 60_000),
    bucket: 'tenant',
  },
  outreach: {
    dailyLimit: Number(process.env.RATE_LIMIT_OUTREACH_DAILY ?? 750),
    burstLimit: Number(process.env.RATE_LIMIT_OUTREACH_BURST ?? 20),
    burstWindowMs: Number(process.env.RATE_LIMIT_OUTREACH_WINDOW_MS ?? 60_000),
    bucket: 'tenant',
  },
};

export class RateLimitError extends Error {
  constructor(
    message: string,
    public action: RateLimitAction,
    public reason: RateLimitReason,
    public retryAfterMs: number,
    public tenantId: string,
    public userId: string | null,
    public limit: number | undefined,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class RateLimiter {
  private snapshots: Record<RateLimitAction, Map<string, RateLimitSnapshot>> = {
    api: new Map(),
    llm: new Map(),
    agentRun: new Map(),
    outreach: new Map(),
  };

  private limitStrikes = new Map<string, { count: number; firstAt: number }>();

  constructor(
    private config: Record<RateLimitAction, RateLimitConfig> = DEFAULT_CONFIG,
    private planResolver: PlanResolver = defaultPlanResolver,
    private securityLogger: SecurityLogger = defaultSecurityLogger,
    private clock: () => number = Date.now,
  ) {}

  async consume({ tenantId, userId, action }: RateLimitContext): Promise<RateLimitResult> {
    const resolvedTenantId = tenantId ?? DEFAULT_TENANT_ID;
    const resolvedUserId = userId ?? DEFAULT_USER_ID;
    const now = this.clock();
    const config = await this.resolveConfig(action, resolvedTenantId);
    const bucketKey = this.getBucketKey(config.bucket, resolvedTenantId, resolvedUserId, action);
    const snapshot = this.getSnapshot(action, bucketKey, now);

    snapshot.burstTimestamps = snapshot.burstTimestamps.filter(
      (timestamp) => now - timestamp < config.burstWindowMs,
    );

    if (config.dailyLimit != null && snapshot.dailyCount >= config.dailyLimit) {
      const retryAfterMs = snapshot.dailyResetAt - now;
      const error = new RateLimitError(
        'Daily request limit reached',
        action,
        'daily',
        retryAfterMs,
        resolvedTenantId,
        resolvedUserId,
        config.dailyLimit,
      );

      await this.recordLimitExceeded(bucketKey, error);
      throw error;
    }

    if (config.burstLimit != null && snapshot.burstTimestamps.length >= config.burstLimit) {
      const oldestTimestamp = snapshot.burstTimestamps[0];
      const retryAfterMs = Math.max(0, config.burstWindowMs - (now - oldestTimestamp));
      const error = new RateLimitError(
        'Too many requests. Please slow down.',
        action,
        'burst',
        retryAfterMs,
        resolvedTenantId,
        resolvedUserId,
        config.burstLimit,
      );

      await this.recordLimitExceeded(bucketKey, error);
      throw error;
    }

    snapshot.dailyCount = snapshot.dailyCount + 1;
    snapshot.burstTimestamps.push(now);

    this.snapshots[action].set(bucketKey, snapshot);

    return {
      remainingDaily: config.dailyLimit == null ? null : Math.max(0, config.dailyLimit - snapshot.dailyCount),
      remainingBurst: config.burstLimit == null ? null : Math.max(0, config.burstLimit - snapshot.burstTimestamps.length),
      dailyResetAt: config.dailyLimit == null ? null : snapshot.dailyResetAt,
    } satisfies RateLimitResult;
  }

  resetAll() {
    Object.values(this.snapshots).forEach((map) => map.clear());
    this.limitStrikes.clear();
  }

  private async resolveConfig(action: RateLimitAction, tenantId: string): Promise<RateLimitConfig> {
    const plan = await this.planResolver(tenantId);
    const overrides = parsePlanRateLimits(plan)?.[action];

    return {
      ...this.config[action],
      ...overrides,
    } satisfies RateLimitConfig;
  }

  private getBucketKey(
    bucket: RateLimitConfig['bucket'],
    tenantId: string,
    userId: string | null,
    action: RateLimitAction,
  ) {
    return bucket === 'tenant'
      ? `${tenantId}:${action}`
      : `${tenantId}:${userId ?? DEFAULT_USER_ID}:${action}`;
  }

  private getSnapshot(action: RateLimitAction, key: string, now: number) {
    const existing = this.snapshots[action].get(key);

    if (!existing || now >= existing.dailyResetAt) {
      return {
        dailyCount: 0,
        dailyResetAt: now + ONE_DAY_MS,
        burstTimestamps: [],
      } satisfies RateLimitSnapshot;
    }

    return existing;
  }

  private async recordLimitExceeded(key: string, error: RateLimitError) {
    const now = this.clock();
    const windowStart = now - LOG_WINDOW_MS;
    const existing = this.limitStrikes.get(key);

    const withinWindow = existing && existing.firstAt >= windowStart;
    const updatedCount = withinWindow ? existing.count + 1 : 1;
    const firstAt = withinWindow ? existing.firstAt : now;

    if (updatedCount >= LOG_THRESHOLD) {
      this.limitStrikes.set(key, { count: 0, firstAt: now });
      await this.securityLogger({
        tenantId: error.tenantId,
        userId: error.userId,
        action: error.action,
        reason: error.reason,
        limit: error.limit,
        retryAfterMs: error.retryAfterMs,
      });
      return;
    }

    this.limitStrikes.set(key, { count: updatedCount, firstAt });
  }
}

const defaultPlanResolver: PlanResolver = async (tenantId) => (await getTenantPlan(tenantId))?.plan ?? null;

const defaultSecurityLogger: SecurityLogger = async (entry) => {
  await logRateLimitThreshold({
    tenantId: entry.tenantId,
    userId: entry.userId,
    action: entry.action,
    reason: entry.reason,
    limit: entry.limit,
    retryAfterMs: entry.retryAfterMs,
  });
};

function parsePlanRateLimits(plan: SubscriptionPlan | null):
  | Partial<Record<RateLimitAction, RateLimitPlanOverrides>>
  | null {
  if (!plan?.limits || typeof plan.limits !== 'object' || Array.isArray(plan.limits)) {
    return null;
  }

  const rateLimits = (plan.limits as Record<string, unknown>).rateLimits;
  if (!rateLimits || typeof rateLimits !== 'object' || Array.isArray(rateLimits)) {
    return null;
  }

  const normalized: Partial<Record<RateLimitAction, RateLimitPlanOverrides>> = {};

  Object.values(RATE_LIMIT_ACTIONS).forEach((action) => {
    const overrides = (rateLimits as Record<string, unknown>)[action];
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return;

    const typedOverrides = overrides as Record<string, unknown>;
    normalized[action] = {
      dailyLimit: toNumber(typedOverrides.dailyLimit),
      burstLimit: toNumber(typedOverrides.burstLimit),
      burstWindowMs: toNumber(typedOverrides.burstWindowMs),
      bucket: typedOverrides.bucket === 'tenant' || typedOverrides.bucket === 'user'
        ? typedOverrides.bucket
        : undefined,
    } satisfies RateLimitPlanOverrides;
  });

  return normalized;
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return undefined;
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

export async function consumeRateLimit(context: RateLimitContext) {
  return globalRateLimiter.consume(context);
}

export function resetRateLimiter() {
  globalRateLimiter.resetAll();
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}
