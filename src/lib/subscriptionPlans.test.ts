import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Prisma } from '@/server/db/prisma';
import type { SubscriptionPlan, TenantSubscription } from '@/server/db/prisma';
import { getTenantPlan } from './subscriptionPlans';

const prismaMock = vi.hoisted(() => ({
  tenantSubscription: {
    findFirst: vi.fn(),
  },
}));

const isTableAvailableMock = vi.hoisted(() => vi.fn());
const isPrismaUnavailableErrorMock = vi.hoisted(() => vi.fn());

vi.mock('./prisma', () => ({
  prisma: prismaMock,
  isTableAvailable: isTableAvailableMock,
  isPrismaUnavailableError: isPrismaUnavailableErrorMock,
}));

describe('getTenantPlan', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-01T00:00:00.000Z'));
    prismaMock.tenantSubscription.findFirst.mockReset();
    isTableAvailableMock.mockReset();
    isPrismaUnavailableErrorMock.mockReset();
    isTableAvailableMock.mockResolvedValue(true);
    isPrismaUnavailableErrorMock.mockReturnValue(false);
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

  it('returns null when the subscription table is missing', async () => {
    isTableAvailableMock.mockResolvedValue(false);

    await expect(getTenantPlan('tenant-1')).resolves.toBeNull();

    expect(prismaMock.tenantSubscription.findFirst).not.toHaveBeenCalled();
  });

  it('returns null when Prisma reports the table is unavailable', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('Missing table', {
      code: 'P2021',
      clientVersion: '5.19.0',
    });

    isTableAvailableMock.mockRejectedValue(prismaError);
    isPrismaUnavailableErrorMock.mockReturnValue(true);

    await expect(getTenantPlan('tenant-3')).resolves.toBeNull();

    expect(prismaMock.tenantSubscription.findFirst).not.toHaveBeenCalled();
  });
});
