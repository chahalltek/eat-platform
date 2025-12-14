/// <reference types="vitest/globals" />

import { JobCandidateStatus } from '@prisma/client';

import { POST } from './route';
import { prisma } from '@/server/db';
import { getCurrentUser } from '@/lib/auth/user';
import { recordAuditEvent } from '@/lib/audit/trail';

const prismaMock = vi.hoisted(() => ({
  jobCandidate: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/server/db', async (importOriginal) => {
  const previousAllowConstruction = process.env.VITEST_PRISMA_ALLOW_CONSTRUCTION;
  process.env.VITEST_PRISMA_ALLOW_CONSTRUCTION = 'true';

  const actual = await importOriginal<typeof import('@/server/db')>();

  process.env.VITEST_PRISMA_ALLOW_CONSTRUCTION = previousAllowConstruction;

  return {
    ...actual,
    prisma: prismaMock,
  };
});

vi.mock('@/lib/auth/user', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/audit/trail', () => ({
  recordAuditEvent: vi.fn(),
}));

describe('POST /api/job-candidate/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enforces permission boundaries for non-owners', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', role: 'RECRUITER', tenantId: 'tenant-1' } as never);
    vi.mocked(prisma.jobCandidate.findUnique).mockResolvedValue({
      id: 'jc-1',
      status: 'POTENTIAL',
      userId: 'other-user',
      tenantId: 'tenant-1',
    } as never);

    const request = new Request('http://localhost/api/job-candidate/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
      body: JSON.stringify({ jobCandidateId: 'jc-1', status: 'SUBMITTED' }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe('Forbidden');
    expect(recordAuditEvent).toHaveBeenCalledWith({
      action: 'JOB_CANDIDATE_STATUS_DENIED',
      resource: 'JobCandidate',
      resourceId: 'jc-1',
      userId: 'user-1',
      metadata: { attemptedStatus: 'SUBMITTED', owner: 'other-user' },
      ip: '203.0.113.10',
    });
  });

  it('allows admins to override data isolation rules', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1', role: 'ADMIN', tenantId: 'tenant-1' } as never);
    vi.mocked(prisma.jobCandidate.findUnique).mockResolvedValue({
      id: 'jc-2',
      status: 'POTENTIAL',
      userId: 'owner-2',
      tenantId: 'tenant-1',
    } as never);
    vi.mocked(prisma.jobCandidate.update).mockResolvedValue({ id: 'jc-2', status: 'SUBMITTED' } as never);

    const request = new Request('http://localhost/api/job-candidate/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.5' },
      body: JSON.stringify({ jobCandidateId: 'jc-2', status: 'SUBMITTED' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(prisma.jobCandidate.update).toHaveBeenCalledWith({
      where: { id: 'jc-2' },
      data: { status: 'SUBMITTED', userId: 'owner-2' },
    });
    expect(recordAuditEvent).toHaveBeenCalledWith({
      action: 'JOB_CANDIDATE_STATUS_UPDATED',
      resource: 'JobCandidate',
      resourceId: 'jc-2',
      userId: 'admin-1',
      metadata: { previousStatus: 'POTENTIAL', newStatus: 'SUBMITTED' },
      ip: '198.51.100.5',
    });
  });

  it('claims unassigned candidates to maintain isolation', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-2', role: 'SOURCER', tenantId: 'tenant-1' } as never);
    vi.mocked(prisma.jobCandidate.findUnique).mockResolvedValue({
      id: 'jc-3',
      status: 'POTENTIAL',
      userId: null,
      tenantId: 'tenant-1',
    } as never);
    vi.mocked(prisma.jobCandidate.update).mockResolvedValue({ id: 'jc-3', status: 'SHORTLISTED', userId: 'user-2' } as never);

    const request = new Request('http://localhost/api/job-candidate/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': '192.0.2.44' },
      body: JSON.stringify({ jobCandidateId: 'jc-3', status: 'SHORTLISTED' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(prisma.jobCandidate.update).toHaveBeenCalledWith({
      where: { id: 'jc-3' },
      data: { status: 'SHORTLISTED', userId: 'user-2' },
    });
    expect(recordAuditEvent).toHaveBeenCalledWith({
      action: 'JOB_CANDIDATE_STATUS_UPDATED',
      resource: 'JobCandidate',
      resourceId: 'jc-3',
      userId: 'user-2',
      metadata: { previousStatus: 'POTENTIAL', newStatus: 'SHORTLISTED' },
      ip: '192.0.2.44',
    });
  });
});
