import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { USER_HEADER, ROLE_HEADER, TENANT_HEADER } from './lib/auth/config';
import { clearSessionCookie, getValidatedSession } from './lib/auth/session';
import { middleware } from './middleware';

vi.mock('./lib/auth/session', () => ({
  getValidatedSession: vi.fn(),
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
    vi.mocked(getValidatedSession).mockResolvedValue({
      session: {
        userId: 'charlie',
        tenantId: 'default-tenant',
        role: 'RECRUITER',
        exp: Math.floor(Date.now() / 1000) + 60,
        iat: Math.floor(Date.now() / 1000),
      },
      error: null,
    });
  });

  function mockSessionRole(role: string) {
    vi.mocked(getValidatedSession).mockResolvedValue({
      session: {
        userId: 'charlie',
        tenantId: 'default-tenant',
        role,
        exp: Math.floor(Date.now() / 1000) + 60,
        iat: Math.floor(Date.now() / 1000),
      },
      error: null,
    });
  }

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

  it('allows fulfillment decision pages for recruiter users', async () => {
    const response = await middleware(createRequest('/fulfillment/decisions/rec-123'));

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

  it('allows admin pages for admin users', async () => {
    mockSessionRole('ADMIN');

    const response = await middleware(createRequest('/admin/feature-flags'));

    expect(response.status).toBe(200);
    expect(response.headers.get(ROLE_HEADER)).toBe('ADMIN');
  });

  it('sets tenant header from admin path for global admins', async () => {
    mockSessionRole('ADMIN');

    const response = await middleware(createRequest('/api/admin/tenant/other-tenant/mode'));

    expect(response.status).toBe(200);
    expect(response.headers.get(TENANT_HEADER)).toBe('other-tenant');
  });

  it('allows admin pages for data access users', async () => {
    mockSessionRole('DATA_ACCESS');

    const response = await middleware(createRequest('/admin/feature-flags'));

    expect(response.status).toBe(200);
    expect(response.headers.get(ROLE_HEADER)).toBe('DATA_ACCESS');
  });

  it('allows admin pages for tenant admins', async () => {
    mockSessionRole('TENANT_ADMIN');

    const response = await middleware(createRequest('/admin/feature-flags'));

    expect(response.status).toBe(200);
    expect(response.headers.get(ROLE_HEADER)).toBe('TENANT_ADMIN');
  });

  it('returns forbidden for admin apis when role is not allowed', async () => {
    const response = await middleware(createRequest('/api/admin/tenants'));

    expect(response.status).toBe(403);
  });

  it('redirects unauthenticated users to login for app routes with next param', async () => {
    vi.mocked(getValidatedSession).mockResolvedValue({ session: null, error: null });

    const response = await middleware(createRequest('/dashboard?tab=overview'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.com/login?next=%2Fdashboard%3Ftab%3Doverview');
  });

  it('blocks hiring managers from recruiter-only routes', async () => {
    mockSessionRole('MANAGER');

    const response = await middleware(createRequest('/api/jobs'));

    expect(response.status).toBe(403);
  });

  it('allows hiring manager pages for manager roles', async () => {
    mockSessionRole('MANAGER');

    const response = await middleware(createRequest('/ete/hiring-manager/jobs/123'));

    expect(response.status).toBe(200);
    expect(response.headers.get(ROLE_HEADER)).toBe('MANAGER');
  });

  it('returns json unauthorized for api routes without a session', async () => {
    vi.mocked(getValidatedSession).mockResolvedValue({ session: null, error: null });

    const response = await middleware(createRequest('/api/jobs'));

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('application/json');
  });
});
