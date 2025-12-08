import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SubscriptionPlan, TenantSubscription } from '@prisma/client';

import {
  FEATURE_FLAGS,
  isFeatureEnabledForTenant,
  resetFeatureFlagCache,
} from './featureFlags';
import { configurePlanFeatureFlags, resetPlanFeatureFlags } from './featureFlags/planMapping';

const prismaMock = vi.hoisted(() => ({
  featureFlag: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('./prisma', () => ({
  prisma: prismaMock,
}));

const getTenantPlan = vi.hoisted(() => vi.fn());

vi.mock('./subscriptionPlans', () => ({
  getTenantPlan,
}));

describe('isFeatureEnabledForTenant', () => {
  const subscriptionPlan: SubscriptionPlan = {
    id: 'plan-enterprise',
    name: 'Enterprise',
    limits: {},
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  const activeSubscription: TenantSubscription & { plan: SubscriptionPlan } = {
    id: 'sub-1',
    tenantId: 'tenant-1',
    planId: subscriptionPlan.id,
    startAt: new Date('2024-02-01T00:00:00.000Z'),
    endAt: null,
    isTrial: false,
    createdAt: new Date('2024-02-01T00:00:00.000Z'),
    plan: subscriptionPlan,
  };

  beforeEach(() => {
    resetFeatureFlagCache();
    resetPlanFeatureFlags();
    configurePlanFeatureFlags({ [subscriptionPlan.id]: [FEATURE_FLAGS.AGENTS] });
    prismaMock.featureFlag.findUnique.mockReset();
    getTenantPlan.mockReset();
  });

  afterEach(() => {
    resetFeatureFlagCache();
    resetPlanFeatureFlags();
    vi.clearAllMocks();
  });

  it('returns plan defaults when no override exists', async () => {
    prismaMock.featureFlag.findUnique.mockResolvedValue(null);
    getTenantPlan.mockResolvedValue({ plan: subscriptionPlan, subscription: activeSubscription });

    const enabled = await isFeatureEnabledForTenant('tenant-1', FEATURE_FLAGS.AGENTS);

    expect(enabled).toBe(true);
    expect(prismaMock.featureFlag.findUnique).toHaveBeenCalledWith({
      where: { tenantId_name: { tenantId: 'tenant-1', name: FEATURE_FLAGS.AGENTS } },
    });
    expect(getTenantPlan).toHaveBeenCalledWith('tenant-1');
  });

  it('prefers override values over plan mappings', async () => {
    prismaMock.featureFlag.findUnique.mockResolvedValue({
      id: 'flag-1',
      tenantId: 'tenant-2',
      name: FEATURE_FLAGS.AGENTS,
      description: 'Manually disabled',
      enabled: false,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    });

    const enabled = await isFeatureEnabledForTenant('tenant-2', FEATURE_FLAGS.AGENTS);

    expect(enabled).toBe(false);
    expect(getTenantPlan).not.toHaveBeenCalled();
  });
});
