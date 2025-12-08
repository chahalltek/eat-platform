import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SubscriptionPlan } from '@prisma/client';

import { getTenantPlan } from '@/lib/subscriptionPlans';
import type { RateLimitAction, RateLimitConfig } from './rateLimiter';
import {
  RateLimitError,
  RateLimiter,
  RATE_LIMIT_ACTIONS,
  consumeRateLimit,
  resetRateLimiter,
} from './rateLimiter';

vi.mock('@/lib/subscriptionPlans', () => ({
  getTenantPlan: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/audit/securityEvents', () => ({
  logRateLimitThreshold: vi.fn(),
}));

const DEFAULT_CONFIG: Record<RateLimitAction, RateLimitConfig> = {
  api: { dailyLimit: 10, burstLimit: 3, burstWindowMs: 5_000, bucket: 'tenant' },
  llm: { dailyLimit: 10, burstLimit: 20, burstWindowMs: 5_000, bucket: 'user' },
  agentRun: { dailyLimit: 5, burstLimit: 2, burstWindowMs: 5_000, bucket: 'tenant' },
  outreach: { dailyLimit: 4, burstLimit: 2, burstWindowMs: 5_000, bucket: 'tenant' },
};

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enforces burst limits and reports retry window', async () => {
    const limiter = new RateLimiter(DEFAULT_CONFIG, async () => null, () => {}, () => Date.now());
    const context = { tenantId: 'tenant-1', userId: 'user-1', action: RATE_LIMIT_ACTIONS.API } as const;

    await limiter.consume(context);
    await limiter.consume(context);
    await limiter.consume(context);

    await expect(limiter.consume(context)).rejects.toMatchObject({
      action: RATE_LIMIT_ACTIONS.API,
      reason: 'burst',
    });
  });

  it('applies higher plan limits when provided', async () => {
    const planResolver = vi.fn().mockResolvedValue({
      limits: {
        rateLimits: {
          [RATE_LIMIT_ACTIONS.AGENT_RUN]: { dailyLimit: 10, burstLimit: 4, burstWindowMs: 5_000 },
        },
      },
    });

    const limiter = new RateLimiter(DEFAULT_CONFIG, planResolver, () => {}, () => Date.now());

    const context = { tenantId: 'tenant-enterprise', userId: 'user-a', action: RATE_LIMIT_ACTIONS.AGENT_RUN } as const;

    for (let i = 0; i < 4; i += 1) {
      await limiter.consume(context);
    }

    await expect(limiter.consume(context)).rejects.toBeInstanceOf(RateLimitError);
    expect(planResolver).toHaveBeenCalledWith('tenant-enterprise');
  });

  it('shares tenant pools across users when configured', async () => {
    const limiter = new RateLimiter(DEFAULT_CONFIG, async () => null, () => {}, () => Date.now());
    const userOne = { tenantId: 'tenant-2', userId: 'user-one', action: RATE_LIMIT_ACTIONS.OUTREACH } as const;
    const userTwo = { tenantId: 'tenant-2', userId: 'user-two', action: RATE_LIMIT_ACTIONS.OUTREACH } as const;

    await limiter.consume(userOne);
    await limiter.consume(userOne);

    await expect(limiter.consume(userTwo)).rejects.toMatchObject({ reason: 'burst' });
  });

  it('resets daily usage after the window expires', async () => {
    const limiter = new RateLimiter(DEFAULT_CONFIG, async () => null, () => {}, () => Date.now());
    const context = { tenantId: 'tenant-3', userId: 'user-3', action: RATE_LIMIT_ACTIONS.LLM } as const;

    for (let i = 0; i < 10; i += 1) {
      await limiter.consume(context);
    }

    await expect(limiter.consume(context)).rejects.toMatchObject({ reason: 'daily' });

    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);

    await expect(limiter.consume(context)).resolves.toBeDefined();
  });

  it('logs to the security logger after repeated threshold hits', async () => {
    const securityLogger = vi.fn();
    const limiter = new RateLimiter(DEFAULT_CONFIG, async () => null, securityLogger, () => Date.now());
    const context = { tenantId: 'tenant-4', userId: 'user-4', action: RATE_LIMIT_ACTIONS.API } as const;

    for (let i = 0; i < 3; i += 1) {
      await limiter.consume(context);
    }

    await expect(limiter.consume(context)).rejects.toBeInstanceOf(RateLimitError);
    await expect(limiter.consume(context)).rejects.toBeInstanceOf(RateLimitError);
    await expect(limiter.consume(context)).rejects.toBeInstanceOf(RateLimitError);

    expect(securityLogger).toHaveBeenCalledTimes(1);
    expect(securityLogger).toHaveBeenCalledWith(
      expect.objectContaining({ action: RATE_LIMIT_ACTIONS.API, tenantId: 'tenant-4', reason: 'burst' }),
    );
  });

  it('supports resetAll after a burst limit trip', async () => {
    const limiter = new RateLimiter(DEFAULT_CONFIG, async () => null, () => {}, () => Date.now());
    const context = { tenantId: 'tenant-5', userId: 'user-5', action: RATE_LIMIT_ACTIONS.AGENT_RUN } as const;

    await limiter.consume(context);
    await limiter.consume(context);
    await expect(limiter.consume(context)).rejects.toBeInstanceOf(RateLimitError);

    limiter.resetAll();

    await expect(limiter.consume(context)).resolves.toBeDefined();
  });

  it('uses the global rate limiter with the default plan resolver', async () => {
    await consumeRateLimit({ tenantId: 'tenant-global', userId: 'user-global', action: RATE_LIMIT_ACTIONS.API });
    resetRateLimiter();

    expect(getTenantPlan).toHaveBeenCalledWith('tenant-global');
  });

  it('avoids plan resolution in edge runtime', async () => {
    vi.resetModules();
    (globalThis as unknown as { EdgeRuntime?: string }).EdgeRuntime = 'edge';
    (globalThis as { __EAT_RATE_LIMITER?: unknown }).__EAT_RATE_LIMITER = undefined;

    const rateLimiterModule = await import('./rateLimiter');
    const subscriptionsModule = await import('@/lib/subscriptionPlans');

    subscriptionsModule.getTenantPlan.mockClear();

    await rateLimiterModule.consumeRateLimit({
      tenantId: 'edge-tenant',
      userId: 'edge-user',
      action: RATE_LIMIT_ACTIONS.API,
    });

    rateLimiterModule.resetRateLimiter();

    expect(subscriptionsModule.getTenantPlan).not.toHaveBeenCalled();

    delete (globalThis as { EdgeRuntime?: string }).EdgeRuntime;
    vi.resetModules();
  });

  it('parses string based plan overrides', async () => {
    const limiter = new RateLimiter(
      DEFAULT_CONFIG,
      async () =>
        ({
          id: 'plan',
          name: 'Stringy',
          limits: {
            rateLimits: {
              [RATE_LIMIT_ACTIONS.OUTREACH]: { dailyLimit: '3', burstLimit: '3', bucket: 'user' },
            },
          },
          createdAt: new Date(),
        } as unknown as SubscriptionPlan),
      () => {},
      () => Date.now(),
    );

    const context = { tenantId: 'tenant-6', userId: 'user-6', action: RATE_LIMIT_ACTIONS.OUTREACH } as const;

    await limiter.consume(context);
    await limiter.consume(context);
    await limiter.consume(context);
    await expect(limiter.consume(context)).rejects.toBeInstanceOf(RateLimitError);
  });
});
