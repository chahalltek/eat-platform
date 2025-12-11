import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadTenantMode } from './loadTenantMode';

const prismaMock = vi.hoisted(() => ({
  tenantMode: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
  isPrismaUnavailableError: () => false,
}));

describe('loadTenantMode', () => {
  const tenantId = 'tenant-123';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('falls back to the pilot defaults when the tenant mode table is missing', async () => {
    prismaMock.tenantMode.findUnique.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('missing table', {
        code: 'P2021',
        clientVersion: '5.0.0',
      }),
    );

    await expect(loadTenantMode(tenantId)).resolves.toEqual({
      mode: 'pilot',
      guardrailsPreset: 'conservative',
      agentsEnabled: ['RUA', 'RINA', 'MATCH', 'SHORTLIST'],
    });
  });

  it('returns the stored tenant mode when the record exists', async () => {
    prismaMock.tenantMode.findUnique.mockResolvedValue({ mode: 'production' });

    await expect(loadTenantMode(tenantId)).resolves.toEqual({
      mode: 'production',
      guardrailsPreset: 'balanced',
      agentsEnabled: ['RUA', 'RINA', 'MATCH', 'CONFIDENCE', 'EXPLAIN', 'SHORTLIST'],
    });
  });
});
