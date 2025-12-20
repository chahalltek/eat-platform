import { describe, expect, it, vi } from 'vitest';

import type { PrismaClient, UsageEventType } from '@/server/db/prisma';

import { formatUsageTotal, getCurrentMonthStart, getMonthlyUsageSnapshots } from './summary';

const isTableAvailable = vi.hoisted(() => vi.fn());
const mockGroupBy = vi.hoisted(() => vi.fn());
const mockFindMany = vi.hoisted(() => vi.fn());

vi.mock('@/server/db/prisma', () => ({
  isTableAvailable: isTableAvailable,
  prisma: {
    usageEvent: { groupBy: mockGroupBy },
    tenant: { findMany: mockFindMany },
  } as unknown as PrismaClient,
}));

describe('getCurrentMonthStart', () => {
  it('returns the UTC start of the month', () => {
    const reference = new Date('2024-03-15T12:00:00Z');
    expect(getCurrentMonthStart(reference).toISOString()).toBe('2024-03-01T00:00:00.000Z');
  });
});

describe('getMonthlyUsageSnapshots', () => {
  it('returns an empty list when the usage table is unavailable', async () => {
    isTableAvailable.mockResolvedValue(false);

    const result = await getMonthlyUsageSnapshots();

    expect(result).toEqual([]);
  });

  it('returns totals per tenant for the current month', async () => {
    isTableAvailable.mockResolvedValue(true);
    mockFindMany.mockResolvedValue([{ id: 'tenant-a', name: 'Tenant A' }]);
    mockGroupBy.mockResolvedValue([
      { tenantId: 'tenant-a', eventType: 'AGENT_RUN' as UsageEventType, _sum: { count: 3 } },
      { tenantId: 'tenant-a', eventType: 'EXPLAIN_CALL' as UsageEventType, _sum: { count: 2 } },
    ]);

    const result = await getMonthlyUsageSnapshots(new Date('2024-04-02T12:00:00Z'));

    expect(result).toHaveLength(1);
    expect(result[0].tenantId).toBe('tenant-a');
    expect(result[0].totals.AGENT_RUN).toBe(3);
    expect(result[0].totals.EXPLAIN_CALL).toBe(2);
    expect(result[0].totals.COPILOT_CALL).toBe(0);
    expect(result[0].monthStart.toISOString()).toBe('2024-04-01T00:00:00.000Z');
  });
});

describe('formatUsageTotal', () => {
  it('returns the total for a given dimension', () => {
    const totals = { AGENT_RUN: 5 } as Record<UsageEventType, number>;
    expect(formatUsageTotal(totals, 'AGENT_RUN')).toBe(5);
  });
});
