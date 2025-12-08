import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SubscriptionPlan, TenantSubscription } from '@prisma/client';
import { getTenantPlan } from './subscriptionPlans';

const prismaMock = vi.hoisted(() => ({
  tenantSubscription: {
    findFirst: vi.fn(),
  },
}));

vi.mock('./prisma', () => ({
  prisma: prismaMock,
}));

describe('getTenantPlan', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-01T00:00:00.000Z'));
    prismaMock.tenantSubscription.findFirst.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    prismaMock.tenantSubscription.findFirst.mockReset();
  });

  it('returns the active subscription and plan for a tenant', async () => {
    const plan: SubscriptionPlan = {
      id: 'plan-standard',
      name: 'Standard',
      limits: { maxAgents: 5 },
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    };

    const subscription: TenantSubscription & { plan: SubscriptionPlan } = {
      id: 'sub-1',
      tenantId: 'tenant-1',
      planId: plan.id,
      startAt: new Date('2024-04-01T00:00:00.000Z'),
      endAt: null,
      isTrial: false,
      createdAt: new Date('2024-04-01T00:00:00.000Z'),
      plan,
    };

    prismaMock.tenantSubscription.findFirst.mockResolvedValue(subscription as TenantSubscription & { plan: SubscriptionPlan });

    const result = await getTenantPlan('tenant-1');

    expect(prismaMock.tenantSubscription.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        startAt: { lte: new Date('2024-05-01T00:00:00.000Z') },
        OR: [{ endAt: null }, { endAt: { gt: new Date('2024-05-01T00:00:00.000Z') } }],
      },
      orderBy: { startAt: 'desc' },
      include: { plan: true },
    });

    expect(result).toEqual({ plan, subscription });
  });

  it('returns null when there is no active subscription', async () => {
    prismaMock.tenantSubscription.findFirst.mockResolvedValue(null);

    const result = await getTenantPlan('tenant-2');

    expect(result).toBeNull();
    expect(prismaMock.tenantSubscription.findFirst).toHaveBeenCalledOnce();
  });
});
