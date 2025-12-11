import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SubscriptionPlan, TenantSubscription } from '@prisma/client';

import {
  FEATURE_FLAGS,
  getFeatureFlag,
  isFeatureEnabledForTenant,
  isEnabled,
  parseFeatureFlagName,
  resetFeatureFlagCache,
} from './featureFlags';
import { configurePlanFeatureFlags, resetPlanFeatureFlags } from './featureFlags/planMapping';

const prismaMock = vi.hoisted(() => ({
  featureFlag: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn((cb) => cb(prismaMock)),
}));

const isTableAvailable = vi.hoisted(() => vi.fn().mockResolvedValue(true));

vi.mock('./prisma', () => ({
  prisma: prismaMock,
  isTableAvailable,
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
    prismaMock.featureFlag.findFirst.mockReset();
    getTenantPlan.mockReset();
    isTableAvailable.mockResolvedValue(true);
  });

  afterEach(() => {
    resetFeatureFlagCache();
    resetPlanFeatureFlags();
    vi.clearAllMocks();
  });

  it('returns plan defaults when no override exists', async () => {
    prismaMock.featureFlag.findFirst.mockResolvedValue(null);
    getTenantPlan.mockResolvedValue({ plan: subscriptionPlan, subscription: activeSubscription });

    const enabled = await isFeatureEnabledForTenant('tenant-1', FEATURE_FLAGS.AGENTS);

    expect(enabled).toBe(true);
    expect(prismaMock.featureFlag.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', name: FEATURE_FLAGS.AGENTS },
    });
    expect(getTenantPlan).toHaveBeenCalledWith('tenant-1');
  });

  it('prefers override values over plan mappings', async () => {
    prismaMock.featureFlag.findFirst.mockResolvedValue({
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

  it('returns false when the feature flag table is unavailable', async () => {
    isTableAvailable.mockResolvedValue(false);

    const enabled = await getFeatureFlag('tenant-3', FEATURE_FLAGS.AGENTS_MATCHED_UI_V1);

    expect(enabled).toBe(false);
    expect(prismaMock.featureFlag.findFirst).not.toHaveBeenCalled();
  });

  it('proxies explicit tenant checks through isEnabled', async () => {
    prismaMock.featureFlag.findFirst.mockResolvedValue({
      id: 'flag-3',
      tenantId: 'tenant-4',
      name: FEATURE_FLAGS.AGENTS_MATCHED_UI_V1,
      description: 'enabled for ui',
      enabled: true,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    });

    const enabled = await isEnabled('tenant-4', FEATURE_FLAGS.AGENTS_MATCHED_UI_V1);

    expect(enabled).toBe(true);
    expect(prismaMock.featureFlag.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-4', name: FEATURE_FLAGS.AGENTS_MATCHED_UI_V1 },
    });
  });

  it('maps legacy confidence flag names to the canonical key', () => {
    const parsed = parseFeatureFlagName('ete_confidence_enabled');

    expect(parsed).toBe(FEATURE_FLAGS.CONFIDENCE_ENABLED);
  });
});
