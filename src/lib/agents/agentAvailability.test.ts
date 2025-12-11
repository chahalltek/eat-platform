import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAgentAvailability } from './agentAvailability';

const prismaMock = vi.hoisted(() => ({
  agentFlag: { findMany: vi.fn() },
}));

const loadTenantModeMock = vi.hoisted(() => vi.fn());
const isTableAvailableMock = vi.hoisted(() => vi.fn().mockResolvedValue(true));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  isPrismaUnavailableError: () => false,
  isTableAvailable: isTableAvailableMock,
}));

vi.mock('@/lib/modes/loadTenantMode', () => ({
  loadTenantMode: loadTenantModeMock,
}));

describe('getAgentAvailability', () => {
  const tenantId = 'tenant-123';

  const modes = {
    pilot: { mode: 'pilot', agentsEnabled: ['RUA', 'RINA', 'MATCH', 'SHORTLIST'] },
    production: {
      mode: 'production',
      agentsEnabled: ['RUA', 'RINA', 'MATCH', 'CONFIDENCE', 'EXPLAIN', 'SHORTLIST'],
    },
    sandbox: {
      mode: 'sandbox',
      agentsEnabled: ['RUA', 'RINA', 'MATCH', 'CONFIDENCE', 'EXPLAIN', 'SHORTLIST'],
    },
    fireDrill: { mode: 'fire_drill', agentsEnabled: ['RUA', 'RINA', 'MATCH', 'SHORTLIST'] },
  } as const;

  const agentFlags = {
    RUA: { agentName: 'RUA', enabled: true },
    RINA: { agentName: 'RINA', enabled: true },
    MATCH: { agentName: 'MATCH', enabled: true },
    CONFIDENCE: { agentName: 'CONFIDENCE', enabled: true },
    EXPLAIN: { agentName: 'EXPLAIN', enabled: true },
  } as const;

  beforeEach(() => {
    vi.resetAllMocks();
    isTableAvailableMock.mockResolvedValue(true);
  });

  it('enables an agent when mode allows and flag is true', async () => {
    loadTenantModeMock.mockResolvedValue(modes.pilot);
    prismaMock.agentFlag.findMany.mockResolvedValue([agentFlags.MATCH]);

    const { isEnabled } = await getAgentAvailability(tenantId);

    expect(isEnabled('MATCH')).toBe(true);
  });

  it('defaults to enabling an agent when mode allows but flag entry is missing', async () => {
    loadTenantModeMock.mockResolvedValue(modes.production);
    prismaMock.agentFlag.findMany.mockResolvedValue([agentFlags.MATCH]);

    const { isEnabled } = await getAgentAvailability(tenantId);

    expect(isEnabled('CONFIDENCE')).toBe(true);
  });

  it('disables an agent when mode disallows it even if flag is true', async () => {
    loadTenantModeMock.mockResolvedValue(modes.pilot);
    prismaMock.agentFlag.findMany.mockResolvedValue([agentFlags.MATCH, agentFlags.CONFIDENCE]);

    const { isEnabled } = await getAgentAvailability(tenantId);

    expect(isEnabled('CONFIDENCE')).toBe(false);
  });

  it('disables an agent when mode allows but flag is false', async () => {
    loadTenantModeMock.mockResolvedValue(modes.sandbox);
    prismaMock.agentFlag.findMany.mockResolvedValue([{ agentName: 'EXPLAIN', enabled: false }]);

    const { isEnabled } = await getAgentAvailability(tenantId);

    expect(isEnabled('EXPLAIN')).toBe(false);
  });

  it('overrides CONFIDENCE during fire drill regardless of flag', async () => {
    loadTenantModeMock.mockResolvedValue(modes.fireDrill);
    prismaMock.agentFlag.findMany.mockResolvedValue([agentFlags.CONFIDENCE]);

    const { isEnabled } = await getAgentAvailability(tenantId);

    expect(isEnabled('CONFIDENCE')).toBe(false);
  });

  it('overrides EXPLAIN during fire drill regardless of flag', async () => {
    loadTenantModeMock.mockResolvedValue(modes.fireDrill);
    prismaMock.agentFlag.findMany.mockResolvedValue([agentFlags.EXPLAIN]);

    const { isEnabled } = await getAgentAvailability(tenantId);

    expect(isEnabled('EXPLAIN')).toBe(false);
  });

  it('defaults to enabled flags when the AgentFlag table is missing', async () => {
    loadTenantModeMock.mockResolvedValue(modes.production);
    isTableAvailableMock.mockResolvedValue(false);

    const { isEnabled } = await getAgentAvailability(tenantId);

    expect(isEnabled('CONFIDENCE')).toBe(true);
    expect(prismaMock.agentFlag.findMany).not.toHaveBeenCalled();
  });
});
