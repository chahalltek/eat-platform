import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAgentAvailability } from './agentAvailability';

const prismaMock = vi.hoisted(() => ({
  agentFlag: { findMany: vi.fn() },
}));

const loadTenantModeMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('@/lib/modes/loadTenantMode', () => ({
  loadTenantMode: loadTenantModeMock(),
}));

describe('getAgentAvailability', () => {
  const tenantId = 'tenant-123';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('enables an agent when mode allows and flag is true', async () => {
    loadTenantModeMock().mockResolvedValue({ mode: 'pilot', agentsEnabled: ['MATCH'] });
    prismaMock.agentFlag.findMany.mockResolvedValue([{ agentName: 'MATCH', enabled: true }]);

    const { isEnabled } = await getAgentAvailability(tenantId);

    expect(isEnabled('MATCH')).toBe(true);
  });

  it('disables an agent when mode disallows it even if flag is true', async () => {
    loadTenantModeMock().mockResolvedValue({ mode: 'pilot', agentsEnabled: [] });
    prismaMock.agentFlag.findMany.mockResolvedValue([{ agentName: 'MATCH', enabled: true }]);

    const { isEnabled } = await getAgentAvailability(tenantId);

    expect(isEnabled('MATCH')).toBe(false);
  });

  it('disables an agent when mode allows but flag is false', async () => {
    loadTenantModeMock().mockResolvedValue({ mode: 'pilot', agentsEnabled: ['MATCH'] });
    prismaMock.agentFlag.findMany.mockResolvedValue([{ agentName: 'MATCH', enabled: false }]);

    const { isEnabled } = await getAgentAvailability(tenantId);

    expect(isEnabled('MATCH')).toBe(false);
  });

  it('overrides CONFIDENCE during fire drill regardless of flag', async () => {
    loadTenantModeMock().mockResolvedValue({ mode: 'fire_drill', agentsEnabled: ['CONFIDENCE'] });
    prismaMock.agentFlag.findMany.mockResolvedValue([{ agentName: 'CONFIDENCE', enabled: true }]);

    const { isEnabled } = await getAgentAvailability(tenantId);

    expect(isEnabled('CONFIDENCE')).toBe(false);
  });
});
