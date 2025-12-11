import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { USER_HEADER, ROLE_HEADER, TENANT_HEADER } from './lib/auth/config';
import { middleware } from './middleware';

vi.mock('./lib/auth/session', () => ({
  getValidatedSession: vi.fn(async () => ({
    session: {
      userId: 'charlie',
      tenantId: 'default-tenant',
      role: 'RECRUITER',
      exp: Math.floor(Date.now() / 1000) + 60,
      iat: Math.floor(Date.now() / 1000),
    },
    error: null,
  })),
  clearSessionCookie: vi.fn(() => ({ name: 'ete_session', value: '', maxAge: 0 })),
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
    vi.clearAllMocks();
  });

  it('allows public health endpoints without auth checks', async () => {
    const response = await middleware(createRequest('/health'));

    expect(response.status).toBe(200);
  });

  it('redirects legacy eat paths to ete', async () => {
    const response = await middleware(createRequest('/eat/system-map'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/ete/system-map');
  });

  it('allows recruiter routes for recruiter users and sets headers', async () => {
    const response = await middleware(createRequest('/candidates'));

    expect(response.status).toBe(200);
    expect(response.headers.get(USER_HEADER)).toBe('charlie');
    expect(response.headers.get(TENANT_HEADER)).toBe('default-tenant');
    expect(response.headers.get(ROLE_HEADER)).toBe('RECRUITER');
  });

  it('blocks admin pages for non-admin users', async () => {
    const response = await middleware(createRequest('/admin/feature-flags'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/');
  });
});
