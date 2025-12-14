import { Prisma } from '@/server/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertTenantWithinLimits,
  resetSubscriptionPlanResolver,
  setSubscriptionPlanResolver,
  TenantUsageLimitError,
} from './usageLimits';

const prismaMock = vi.hoisted(() => ({
  user: { count: vi.fn() },
  agentPrompt: { count: vi.fn() },
  agentRunLog: { count: vi.fn() },
}));

vi.mock('@/server/db', () => ({
  prisma: prismaMock,
}));

describe('assertTenantWithinLimits', () => {
  const tenantId = 'tenant-123';

  beforeEach(() => {
    vi.resetAllMocks();
    resetSubscriptionPlanResolver();
  });

  it('allows actions when below the subscription plan limit', async () => {
    prismaMock.user.count.mockResolvedValue(3);
    setSubscriptionPlanResolver(() => ({ maxUsers: 5, maxAgents: 1, maxAgentRunsPerDay: 10 }));

    await expect(assertTenantWithinLimits(tenantId, 'createUser')).resolves.toEqual({
      usage: 3,
      limit: 5,
    });

    expect(prismaMock.user.count).toHaveBeenCalledWith({ where: { tenantId } });
  });

  it('throws a structured error when usage meets or exceeds the limit', async () => {
    prismaMock.agentRunLog.count.mockResolvedValue(4);
    setSubscriptionPlanResolver(() => ({ maxUsers: 5, maxAgents: 2, maxAgentRunsPerDay: 4 }));

    await expect(assertTenantWithinLimits(tenantId, 'createAgentRun')).rejects.toEqual(
      new TenantUsageLimitError(tenantId, 'createAgentRun', 4, 4),
    );
  });

  it('skips usage checks when the plan allows unlimited activity', async () => {
    setSubscriptionPlanResolver(() => ({ maxUsers: undefined, maxAgents: undefined, maxAgentRunsPerDay: undefined }));

    await expect(assertTenantWithinLimits(tenantId, 'createAgentDefinition')).resolves.toEqual({
      usage: null,
      limit: undefined,
    });

    expect(prismaMock.agentPrompt.count).not.toHaveBeenCalled();
  });

  it('treats a missing agent prompt table as zero usage', async () => {
    prismaMock.agentPrompt.count.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('missing table', {
        code: 'P2021',
        clientVersion: '5.0.0',
      }),
    );
    setSubscriptionPlanResolver(() => ({ maxUsers: 5, maxAgents: 2, maxAgentRunsPerDay: 5 }));

    await expect(assertTenantWithinLimits(tenantId, 'createAgentDefinition')).resolves.toEqual({
      usage: 0,
      limit: 2,
    });
  });

  it('uses a rolling 24-hour window for agent run usage', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-04-02T12:00:00Z'));
    prismaMock.agentRunLog.count.mockResolvedValue(0);
    setSubscriptionPlanResolver(() => ({ maxUsers: 5, maxAgents: 2, maxAgentRunsPerDay: 5 }));

    await assertTenantWithinLimits(tenantId, 'createAgentRun');

    expect(prismaMock.agentRunLog.count).toHaveBeenCalledWith({
      where: { tenantId, startedAt: { gte: new Date('2024-04-01T12:00:00.000Z') } },
    });

    vi.useRealTimers();
  });
});
