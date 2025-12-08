import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { USER_HEADER, ROLE_HEADER, TENANT_HEADER } from './lib/auth/config';
import { middleware } from './middleware';
import { prisma } from './lib/prisma';

vi.mock('./lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('./lib/rateLimiting/rateLimiter', () => ({
  consumeRateLimit: vi.fn(),
  isRateLimitError: () => false,
  RATE_LIMIT_ACTIONS: { API: 'API' },
}));

vi.mock('./lib/rateLimiting/http', () => ({
  toRateLimitResponse: vi.fn(),
}));

function createRequest(path: string) {
  const url = new URL(`https://example.com${path}`);
  return new NextRequest(url);
}

describe('middleware role enforcement', () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockReset();
  });

  it('allows public health endpoints without auth checks', async () => {
    const response = await middleware(createRequest('/health'));

    expect(response.status).toBe(200);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('blocks recruiter routes when user is missing', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);

    const response = await middleware(createRequest('/jobs'));

    expect(response.status).toBe(401);
  });

  it('allows recruiter routes for recruiter users and sets headers', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'charlie',
      role: 'RECRUITER',
      tenantId: 'tenant-1',
    } as never);

    const response = await middleware(createRequest('/candidates'));

    expect(response.status).toBe(200);
    expect(response.headers.get(USER_HEADER)).toBe('charlie');
    expect(response.headers.get(TENANT_HEADER)).toBe('tenant-1');
    expect(response.headers.get(ROLE_HEADER)).toBe('RECRUITER');
  });

  it('blocks admin pages for non-admin users', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'charlie',
      role: 'RECRUITER',
      tenantId: 'tenant-1',
    } as never);

    const response = await middleware(createRequest('/admin/feature-flags'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/');
  });
});
