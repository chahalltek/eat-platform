/// <reference types="vitest/globals" />

const mocks = vi.hoisted(() => ({
  enforceKillSwitchMock: vi.fn(),
  enforceFeatureFlagMock: vi.fn(),
  requireRecruiterOrAdminMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  handleMatchAgentPostMock: vi.fn(),
  prisma: {
    matchResult: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/killSwitch', () => ({ KILL_SWITCHES: { SCORERS: 'scorers' } }));
vi.mock('@/lib/killSwitch/middleware', () => ({ enforceKillSwitch: mocks.enforceKillSwitchMock }));
vi.mock('@/lib/featureFlags', () => ({ FEATURE_FLAGS: { SCORING: 'scoring' } }));
vi.mock('@/lib/featureFlags/middleware', () => ({ enforceFeatureFlag: mocks.enforceFeatureFlagMock }));
vi.mock('@/lib/auth/requireRole', () => ({ requireRecruiterOrAdmin: mocks.requireRecruiterOrAdminMock }));
vi.mock('@/lib/auth/user', () => ({ getCurrentUser: mocks.getCurrentUserMock }));
vi.mock('@/server/db', () => ({ prisma: mocks.prisma }));
vi.mock('@/app/api/agents/match/route', () => ({
  handleMatchAgentPost: mocks.handleMatchAgentPostMock,
}));

import * as requireRole from '@/lib/auth/requireRole';
import { POST } from './route';

describe('POST /api/match', () => {
  const originalEnv = {
    SECURITY_MODE: process.env.SECURITY_MODE,
    EXECUTION_ENABLED: process.env.EXECUTION_ENABLED,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceKillSwitchMock.mockReturnValue(null);
    mocks.enforceFeatureFlagMock.mockResolvedValue(null);
    mocks.requireRecruiterOrAdminMock.mockImplementation(async (req) => ({
      ok: true,
      user: await mocks.getCurrentUserMock(req),
    }));
    mocks.getCurrentUserMock.mockResolvedValue({
      id: 'user-123',
      role: 'RECRUITER',
      tenantId: 'tenant-123',
    });
    process.env.SECURITY_MODE = 'internal';
    process.env.EXECUTION_ENABLED = 'true';
  });

  afterEach(() => {
    process.env.SECURITY_MODE = originalEnv.SECURITY_MODE;

    if (originalEnv.EXECUTION_ENABLED === undefined) {
      delete process.env.EXECUTION_ENABLED;
    } else {
      process.env.EXECUTION_ENABLED = originalEnv.EXECUTION_ENABLED;
    }
  });

  it('rejects malformed payloads before hitting downstream services', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const requireRecruiterOrAdminSpy = vi.spyOn(requireRole, 'requireRecruiterOrAdmin');

    const request = new Request('http://localhost/api/match', {
      method: 'POST',
      body: JSON.stringify({ jobReqId: '   ', candidateId: 123 }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('jobReqId and candidateId must be non-empty strings');
    expect(mocks.getCurrentUserMock).not.toHaveBeenCalled();
    expect(requireRecruiterOrAdminSpy).not.toHaveBeenCalled();
    expect(mocks.handleMatchAgentPostMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('Match payload validation failed', {
      body: { candidateId: 123, jobReqId: '   ' },
      issues: expect.stringContaining('non-empty string'),
      userId: undefined,
    });

    warnSpy.mockRestore();
  });

  it('returns suggestion-only responses when execution is gated', async () => {
    process.env.SECURITY_MODE = 'preview';
    delete process.env.EXECUTION_ENABLED;
    mocks.enforceFeatureFlagMock.mockResolvedValue(null);
    mocks.handleMatchAgentPostMock.mockResolvedValue(new Response('should not hit', { status: 500 }));

    const request = new Request('http://localhost/api/match', {
      method: 'POST',
      body: JSON.stringify({ jobReqId: 'job-1', candidateId: 'cand-1' }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.suggestionOnly).toBe(true);
    expect(payload.matches).toEqual([]);
    expect(mocks.handleMatchAgentPostMock).not.toHaveBeenCalled();
  });
});
