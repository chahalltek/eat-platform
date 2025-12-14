import { Prisma } from '@/server/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getSystemMode, SYSTEM_MODES, type SystemModeMetadata } from './systemMode';

const prismaMock = vi.hoisted(() => ({
  systemMode: {
    findFirst: vi.fn(),
  },
}));

const isTableAvailable = vi.hoisted(() => vi.fn().mockResolvedValue(true));
const isPrismaUnavailableError = vi.hoisted(() => vi.fn().mockReturnValue(false));
const getCurrentTenantId = vi.hoisted(() => vi.fn().mockResolvedValue('tenant-fallback'));

vi.mock('./prisma', () => ({
  prisma: prismaMock,
  isTableAvailable,
  isPrismaUnavailableError,
}));

vi.mock('./tenant', () => ({
  getCurrentTenantId,
}));

describe('getSystemMode', () => {
  const baseRecord = {
    id: 'system-mode-id',
    tenantId: 'tenant-123',
    mode: SYSTEM_MODES.PILOT,
    metadata: {},
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
  } satisfies { metadata: SystemModeMetadata } & Record<string, unknown>;

  beforeEach(() => {
    prismaMock.systemMode.findFirst.mockReset();
    isTableAvailable.mockResolvedValue(true);
    isPrismaUnavailableError.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to pilot mappings when the table is unavailable', async () => {
    isTableAvailable.mockResolvedValue(false);

    const mode = await getSystemMode('tenant-123');

    expect(mode).toEqual({
      mode: SYSTEM_MODES.PILOT,
      metadata: {},
      guardrailsPreset: 'human-vetted',
      agentEnablement: { basic: true, shortlist: true, agents: false },
    });
    expect(prismaMock.systemMode.findFirst).not.toHaveBeenCalled();
  });

  it('returns sandbox presets when no metadata overrides exist', async () => {
    prismaMock.systemMode.findFirst.mockResolvedValue({ ...baseRecord, mode: SYSTEM_MODES.SANDBOX });

    const mode = await getSystemMode('tenant-123');

    expect(mode.guardrailsPreset).toBe('default-lenient');
    expect(mode.agentEnablement).toEqual({ basic: true, shortlist: true, agents: true });
  });

  it('applies metadata overrides when present', async () => {
    prismaMock.systemMode.findFirst.mockResolvedValue({
      ...baseRecord,
      mode: SYSTEM_MODES.PRODUCTION,
      metadata: { guardrailsPreset: 'custom-preset', agentEnablement: { agents: true } },
    });

    const mode = await getSystemMode('tenant-123');

    expect(mode.guardrailsPreset).toBe('custom-preset');
    expect(mode.agentEnablement).toEqual({ basic: false, shortlist: false, agents: true });
  });

  it('falls back to pilot defaults when no record exists', async () => {
    prismaMock.systemMode.findFirst.mockResolvedValue(null);

    const mode = await getSystemMode();

    expect(getCurrentTenantId).toHaveBeenCalled();
    expect(mode).toEqual({
      mode: SYSTEM_MODES.PILOT,
      metadata: {},
      guardrailsPreset: 'human-vetted',
      agentEnablement: { basic: true, shortlist: true, agents: false },
    });
  });

  it('handles Prisma errors gracefully', async () => {
    prismaMock.systemMode.findFirst.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('missing table', {
        code: 'P2021',
        clientVersion: '5.19',
      }),
    );

    const mode = await getSystemMode('tenant-123');

    expect(mode.mode).toBe(SYSTEM_MODES.PILOT);
    expect(mode.guardrailsPreset).toBe('human-vetted');
  });
});
