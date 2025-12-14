/// <reference types="vitest/globals" />

const mocks = vi.hoisted(() => ({
  enforceKillSwitchMock: vi.fn(),
  enforceFeatureFlagMock: vi.fn(),
  requireRecruiterOrAdminMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  prisma: {
    candidate: { findUnique: vi.fn() },
    jobReq: { findUnique: vi.fn() },
    jobCandidate: { findUnique: vi.fn() },
    outreachInteraction: { count: vi.fn() },
    matchResult: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('@/lib/killSwitch', () => ({ KILL_SWITCHES: { SCORERS: 'scorers' } }));
vi.mock('@/lib/killSwitch/middleware', () => ({ enforceKillSwitch: mocks.enforceKillSwitchMock }));
vi.mock('@/lib/featureFlags', () => ({ FEATURE_FLAGS: { SCORING: 'scoring' } }));
vi.mock('@/lib/featureFlags/middleware', () => ({ enforceFeatureFlag: mocks.enforceFeatureFlagMock }));
vi.mock('@/lib/auth/requireRole', () => ({ requireRecruiterOrAdmin: mocks.requireRecruiterOrAdminMock }));
vi.mock('@/lib/auth/user', () => ({ getCurrentUser: mocks.getCurrentUserMock }));
vi.mock('@/server/db', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/matching/candidateSignals', () => ({ computeCandidateSignalScore: vi.fn() }));
vi.mock('@/lib/matching/freshness', () => ({ computeJobFreshnessScore: vi.fn() }));
vi.mock('@/lib/matching/msa', () => ({ computeMatchScore: vi.fn() }));
vi.mock('@/lib/matching/jobCandidate', () => ({ upsertJobCandidateForMatch: vi.fn() }));

import * as requireRole from '@/lib/auth/requireRole';
import { POST } from './route';

describe('POST /api/match', () => {
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
    expect(mocks.getCurrentUserMock).toHaveBeenCalledTimes(1);
    expect(requireRecruiterOrAdminSpy).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.candidate.findUnique).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('Match payload validation failed', {
      body: { candidateId: 123, jobReqId: '   ' },
      issues: expect.stringContaining('non-empty string'),
      userId: 'user-123',
    });

    warnSpy.mockRestore();
  });
});
