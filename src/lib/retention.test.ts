import { describe, expect, it } from 'vitest';

import { TenantDeletionMode } from '@prisma/client';

import {
  collectTenantData,
  deleteTenantData,
  findExpiredRecords,
  processTenantRetention,
  resolveRetentionPolicy,
  runTenantRetentionJob,
} from './retention';

type InMemoryRecord = Record<string, any> & { tenantId: string; id: string };

type InMemoryModel = {
  data: InMemoryRecord[];
  findMany: ({ where, select }: any) => Promise<any[]>;
  updateMany: ({ where, data }: any) => Promise<{ count: number }>;
  deleteMany: ({ where }: any) => Promise<{ count: number }>;
};

type InMemoryClient = {
  tenant: { findMany: () => Promise<any[]> };
  agentRunLog: InMemoryModel;
  match: InMemoryModel;
  matchResult: InMemoryModel;
  candidate: InMemoryModel;
  candidateSkill: InMemoryModel;
  jobCandidate: InMemoryModel;
  outreachInteraction: InMemoryModel;
  featureFlag: InMemoryModel;
  jobSkill: InMemoryModel;
  jobReq: InMemoryModel;
  customer: InMemoryModel;
  tenantSubscription: InMemoryModel;
  user: InMemoryModel;
  userIdentity: InMemoryModel;
};

const NOW = new Date('2024-02-01T00:00:00.000Z');

function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function matchesWhere(record: InMemoryRecord, where: any) {
  if (!where) return true;
  if (where.tenantId && record.tenantId !== where.tenantId) return false;
  if (where.id?.in && !where.id.in.includes(record.id)) return false;
  if (where.startedAt?.lt && !(record.startedAt < where.startedAt.lt)) return false;
  if (where.createdAt?.lt && !(record.createdAt < where.createdAt.lt)) return false;
  if (where.updatedAt?.lt && !(record.updatedAt < where.updatedAt.lt)) return false;
  if (where.deletedAt === null && record.deletedAt !== null && record.deletedAt !== undefined) return false;
  if (where.candidateId?.in && !where.candidateId.in.includes(record.candidateId)) return false;
  if (where.userId?.in && !where.userId.in.includes(record.userId)) return false;
  return true;
}

function normalizeDataValue(value: any) {
  if (value && typeof value === 'object' && 'isDbNull' in value) return null;
  if (value && typeof value === 'object' && 'isJsonNull' in value) return null;
  return value;
}

function buildModel(records: InMemoryRecord[]): InMemoryModel {
  return {
    data: records,
    async findMany({ where, select } = {}) {
      const results = records.filter((record) => matchesWhere(record, where));
      if (select?.id) {
        return results.map((record) => ({ id: record.id }));
      }
      return results;
    },
    async updateMany({ where, data }) {
      const matches = records.filter((record) => matchesWhere(record, where));
      matches.forEach((record) => {
        Object.assign(record, Object.fromEntries(Object.entries(data).map(([key, value]) => [key, normalizeDataValue(value)])));
      });
      return { count: matches.length };
    },
    async deleteMany({ where }) {
      const before = records.length;
      const remaining = records.filter((record) => !matchesWhere(record, where));
      records.splice(0, records.length, ...remaining);
      return { count: before - remaining.length };
    },
  };
}

function buildClient(): InMemoryClient {
  const agentRunLogData: InMemoryRecord[] = [
    { id: 'arl-old-a', tenantId: 'tenant-a', startedAt: daysAgo(60), deletedAt: null },
    { id: 'arl-new-a', tenantId: 'tenant-a', startedAt: daysAgo(2), deletedAt: null },
    { id: 'arl-old-b', tenantId: 'tenant-b', startedAt: daysAgo(10), deletedAt: null },
  ];

  const matchData: InMemoryRecord[] = [
    { id: 'match-old-a', tenantId: 'tenant-a', createdAt: daysAgo(40), deletedAt: null, jobReqId: 'req', candidateId: 'cand-old-a' },
    { id: 'match-new-a', tenantId: 'tenant-a', createdAt: daysAgo(1), deletedAt: null, jobReqId: 'req', candidateId: 'cand-new-a' },
    { id: 'match-old-b', tenantId: 'tenant-b', createdAt: daysAgo(7), deletedAt: null, jobReqId: 'req', candidateId: 'cand-old-b' },
  ];

  const matchResultData: InMemoryRecord[] = [
    { id: 'mr-old-a', tenantId: 'tenant-a', createdAt: daysAgo(45), deletedAt: null, candidateId: 'cand-old-a', jobReqId: 'req' },
    { id: 'mr-new-a', tenantId: 'tenant-a', createdAt: daysAgo(1), deletedAt: null, candidateId: 'cand-new-a', jobReqId: 'req' },
    { id: 'mr-old-b', tenantId: 'tenant-b', createdAt: daysAgo(8), deletedAt: null, candidateId: 'cand-old-b', jobReqId: 'req' },
  ];

  const candidateData: InMemoryRecord[] = [
    {
      id: 'cand-old-a',
      tenantId: 'tenant-a',
      fullName: 'Old A',
      email: 'old-a@example.com',
      phone: '123',
      createdAt: daysAgo(90),
      updatedAt: daysAgo(90),
      deletedAt: null,
    },
    {
      id: 'cand-new-a',
      tenantId: 'tenant-a',
      fullName: 'New A',
      email: 'new-a@example.com',
      phone: '321',
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
      deletedAt: null,
    },
    {
      id: 'cand-old-b',
      tenantId: 'tenant-b',
      fullName: 'Old B',
      email: 'old-b@example.com',
      phone: '222',
      createdAt: daysAgo(20),
      updatedAt: daysAgo(20),
      deletedAt: null,
    },
    {
      id: 'cand-c-retained',
      tenantId: 'tenant-c',
      fullName: 'Retained',
      email: 'keep@example.com',
      phone: '333',
      createdAt: daysAgo(400),
      updatedAt: daysAgo(400),
      deletedAt: null,
    },
  ];

  const candidateSkills: InMemoryRecord[] = [
    { id: 'skill-b', tenantId: 'tenant-b', candidateId: 'cand-old-b' },
  ];

  const jobCandidates: InMemoryRecord[] = [
    { id: 'jc-b', tenantId: 'tenant-b', candidateId: 'cand-old-b' },
  ];

  const outreach: InMemoryRecord[] = [
    { id: 'out-b', tenantId: 'tenant-b', candidateId: 'cand-old-b' },
  ];

  const featureFlags: InMemoryRecord[] = [
    { id: 'ff-b', tenantId: 'tenant-b' },
  ];

  const customers: InMemoryRecord[] = [
    { id: 'cust-b', tenantId: 'tenant-b' },
  ];

  const jobReqs: InMemoryRecord[] = [
    { id: 'req-b', tenantId: 'tenant-b', customerId: 'cust-b' },
  ];

  const jobSkills: InMemoryRecord[] = [
    { id: 'job-skill-b', tenantId: 'tenant-b', jobReqId: 'req-b' },
  ];

  const tenantSubscriptions: InMemoryRecord[] = [
    { id: 'sub-b', tenantId: 'tenant-b' },
  ];

  const users: InMemoryRecord[] = [
    { id: 'user-a', tenantId: 'tenant-a', email: 'a@example.com' },
    { id: 'user-b', tenantId: 'tenant-b', email: 'b@example.com' },
  ];

  const userIdentities: InMemoryRecord[] = [
    { id: 'uid-b', tenantId: 'tenant-b', userId: 'user-b' },
  ];

  const tenants = [
    { id: 'tenant-a', dataRetentionDays: 30, deletionMode: TenantDeletionMode.SOFT_DELETE },
    { id: 'tenant-b', dataRetentionDays: 5, deletionMode: TenantDeletionMode.HARD_DELETE },
    { id: 'tenant-c', dataRetentionDays: null, deletionMode: TenantDeletionMode.SOFT_DELETE },
  ];

  const modelBuilder = buildModel;

  return {
    tenant: { findMany: async () => tenants },
    agentRunLog: modelBuilder(agentRunLogData),
    match: modelBuilder(matchData),
    matchResult: modelBuilder(matchResultData),
    candidate: modelBuilder(candidateData),
    candidateSkill: modelBuilder(candidateSkills),
    jobCandidate: modelBuilder(jobCandidates),
    outreachInteraction: modelBuilder(outreach),
    featureFlag: modelBuilder(featureFlags),
    jobSkill: modelBuilder(jobSkills),
    jobReq: modelBuilder(jobReqs),
    customer: modelBuilder(customers),
    tenantSubscription: modelBuilder(tenantSubscriptions),
    user: modelBuilder(users),
    userIdentity: modelBuilder(userIdentities),
  } as unknown as InMemoryClient;
}

describe('retention policy evaluation', () => {
  it('returns null when no retention is configured', () => {
    const policy = resolveRetentionPolicy({ id: 't', dataRetentionDays: null, deletionMode: TenantDeletionMode.SOFT_DELETE }, NOW);
    expect(policy).toBeNull();
  });

  it('calculates cutoff based on retention days', () => {
    const policy = resolveRetentionPolicy({ id: 't', dataRetentionDays: 10, deletionMode: TenantDeletionMode.HARD_DELETE }, NOW);
    expect(policy?.cutoff.toISOString()).toBe(daysAgo(10).toISOString());
    expect(policy?.mode).toBe(TenantDeletionMode.HARD_DELETE);
  });
});

describe('retention selection and cleanup', () => {
  it('identifies expired records per tenant', async () => {
    const prisma = buildClient();
    const expired = await findExpiredRecords(prisma as any, 'tenant-a', daysAgo(30));

    expect(expired).toEqual({
      agentRunLogIds: ['arl-old-a'],
      matchIds: ['match-old-a'],
      matchResultIds: ['mr-old-a'],
      candidateIds: ['cand-old-a'],
    });
  });

  it('soft deletes data for tenants configured for retention', async () => {
    const prisma = buildClient();
    const tenant = { id: 'tenant-a', dataRetentionDays: 30, deletionMode: TenantDeletionMode.SOFT_DELETE } as const;

    const result = await processTenantRetention(prisma as any, tenant as any, NOW);

    expect(result.summary).toMatchObject({
      soft: true,
      agentRunLogs: 1,
      matches: 1,
      matchResults: 1,
      candidates: 1,
    });

    const updatedCandidate = (prisma as any).candidate.data.find((c: any) => c.id === 'cand-old-a');
    expect(updatedCandidate.deletedAt).toBeInstanceOf(Date);
    expect(updatedCandidate.fullName).toBe('Removed Candidate');
    expect(updatedCandidate.email).toBeNull();

    const unaffectedCandidate = (prisma as any).candidate.data.find((c: any) => c.id === 'cand-new-a');
    expect(unaffectedCandidate.deletedAt).toBeNull();
  });

  it('runs retention across tenants and hard deletes eligible data only in scope', async () => {
    const prisma = buildClient();
    const response = await runTenantRetentionJob(prisma as any, NOW);

    expect(response.details.processed).toBe(3);
    const tenantBMatches = (prisma as any).match.data.filter((m: any) => m.tenantId === 'tenant-b');
    expect(tenantBMatches).toHaveLength(0);
    const tenantBRemovedCandidate = (prisma as any).candidate.data.find((c: any) => c.tenantId === 'tenant-b');
    expect(tenantBRemovedCandidate).toBeUndefined();

    const tenantCStillThere = (prisma as any).candidate.data.find((c: any) => c.tenantId === 'tenant-c');
    expect(tenantCStillThere).toBeDefined();
  });
});

describe('manual deletion for offboarding', () => {
  it('removes all tenant data in hard delete mode', async () => {
    const prisma = buildClient();

    const preSelection = await collectTenantData(prisma as any, 'tenant-b');
    expect(preSelection.candidateIds).toContain('cand-old-b');

    const summary = await deleteTenantData(prisma as any, 'tenant-b', TenantDeletionMode.HARD_DELETE, NOW);
    expect(summary.soft).toBe(false);
    expect(summary.candidates).toBe(1);
    expect(summary.candidateSkills).toBe(1);
    expect(summary.jobCandidates).toBe(1);
    expect(summary.outreachInteractions).toBe(1);
    expect(summary.featureFlags).toBe(1);
    expect(summary.jobSkills).toBe(1);
    expect(summary.jobReqs).toBe(1);
    expect(summary.customers).toBe(1);
    expect(summary.tenantSubscriptions).toBe(1);
    expect(summary.users).toBe(1);
    expect(summary.userIdentities).toBe(1);

    const postSelection = await collectTenantData(prisma as any, 'tenant-b');
    expect(postSelection).toEqual({ agentRunLogIds: [], matchIds: [], matchResultIds: [], candidateIds: [] });
  });

  it('scrubs tenant data in soft delete mode for manual runs', async () => {
    const prisma = buildClient();
    const summary = await deleteTenantData(prisma as any, 'tenant-a', TenantDeletionMode.SOFT_DELETE, NOW);

    expect(summary.soft).toBe(true);
    expect(summary.candidates).toBeGreaterThan(0);
    const candidate = (prisma as any).candidate.data.find((c: any) => c.id === 'cand-old-a');
    expect(candidate?.fullName).toBe('Removed Candidate');
    expect(candidate?.deletedAt).toBeInstanceOf(Date);
  });
});
