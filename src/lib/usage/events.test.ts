import { describe, expect, it, vi } from 'vitest';

import type { PrismaClient } from '@/server/db/prisma';

import { recordUsageEvent } from './events';

const isTableAvailable = vi.hoisted(() => vi.fn());
const createMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/db/prisma', () => ({
  isTableAvailable: isTableAvailable,
  prisma: { usageEvent: { create: createMock } } as unknown as PrismaClient,
}));

describe('recordUsageEvent', () => {
  it('returns early when the usage table is unavailable', async () => {
    isTableAvailable.mockResolvedValue(false);

    await recordUsageEvent({ tenantId: 'tenant-a', eventType: 'AGENT_RUN' });

    expect(createMock).not.toHaveBeenCalled();
  });

  it('records events with defaults when available', async () => {
    isTableAvailable.mockResolvedValue(true);

    await recordUsageEvent({ tenantId: 'tenant-a', eventType: 'JOBS_PROCESSED' });

    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-a',
        eventType: 'JOBS_PROCESSED',
        count: 1,
      }),
    });
  });
});
