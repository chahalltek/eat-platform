import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadTenantMode } from './loadTenantMode';

const prismaMock = vi.hoisted(() => ({
  tenantMode: {
    findUnique: vi.fn(),
  },
}));

const isTableAvailableMock = vi.hoisted(() => vi.fn().mockResolvedValue(true));

vi.mock('@/server/db/prisma', () => ({
  prisma: prismaMock,
  isPrismaUnavailableError: () => false,
  isTableAvailable: isTableAvailableMock,
}));

describe('loadTenantMode', () => {
  const tenantId = 'tenant-123';

  beforeEach(() => {
    vi.resetAllMocks();
    isTableAvailableMock.mockResolvedValue(true);
  });

  it('falls back to the pilot defaults when the tenant mode table is missing', async () => {
    isTableAvailableMock.mockResolvedValue(false);

    await expect(loadTenantMode(tenantId)).resolves.toEqual({
      mode: 'pilot',
      guardrailsPreset: 'conservative',
      agentsEnabled: ['RUA', 'RINA', 'MATCH', 'SHORTLIST'],
      source: 'fallback',
    });
  });

  it('returns the stored tenant mode when the record exists', async () => {
    isTableAvailableMock.mockResolvedValue(true);
    prismaMock.tenantMode.findUnique.mockResolvedValue({ mode: 'production' });

    await expect(loadTenantMode(tenantId)).resolves.toEqual({
      mode: 'production',
      guardrailsPreset: 'balanced',
      agentsEnabled: ['RUA', 'RINA', 'MATCH', 'CONFIDENCE', 'EXPLAIN', 'SHORTLIST'],
      source: 'database',
    });
  });

  it('falls back to the pilot defaults when Prisma reports a missing table', async () => {
    isTableAvailableMock.mockResolvedValue(true);
    prismaMock.tenantMode.findUnique.mockRejectedValue({ code: 'P2021' });

    await expect(loadTenantMode(tenantId)).resolves.toEqual({
      mode: 'pilot',
      guardrailsPreset: 'conservative',
      agentsEnabled: ['RUA', 'RINA', 'MATCH', 'SHORTLIST'],
      source: 'fallback',
    });
  });
});
