import { TenantDeletionMode, type Tenant } from '@/server/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logComplianceAlert, logComplianceScan } from '@/lib/audit/securityEvents';
import { __dangerousResetAuditTrail, getAuditTrail } from '@/lib/audit/trail';
import { runComplianceAgent } from '@/lib/agents/comply';
import type { RetentionPrisma } from '@/lib/retention';

vi.mock('@/lib/audit/securityEvents', async () => {
  const actual = await vi.importActual<typeof import('@/lib/audit/securityEvents')>('@/lib/audit/securityEvents');
  return {
    ...actual,
    logComplianceAlert: vi.fn(async (input) => ({
      id: 'evt-alert',
      tenantId: input.tenantId ?? 'unknown',
      userId: input.userId ?? null,
      eventType: actual.SECURITY_EVENT_TYPES.COMPLIANCE_ALERT,
      metadata: input.metadata ?? {},
      createdAt: new Date(),
    })),
    logComplianceScan: vi.fn(async (input) => ({
      id: 'evt-scan',
      tenantId: input.tenantId ?? 'unknown',
      userId: input.userId ?? null,
      eventType: actual.SECURITY_EVENT_TYPES.COMPLIANCE_SCAN,
      metadata: input.metadata ?? {},
      createdAt: new Date(),
    })),
  } satisfies typeof import('@/lib/audit/securityEvents');
});

function daysAgo(base: Date, days: number) {
  return new Date(base.getTime() - days * 24 * 60 * 60 * 1000);
}

type InMemoryRecord = {
  id: string;
  tenantId: string;
  startedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
  candidateId?: string;
};

function matchesWhere(record: InMemoryRecord, where: any) {
  if (!where) return true;
  if (where.tenantId && record.tenantId !== where.tenantId) return false;
  if (where.id?.in && !where.id.in.includes(record.id)) return false;
  if (where.startedAt?.lt && !(record.startedAt && record.startedAt < where.startedAt.lt)) return false;
  if (where.createdAt?.lt && !(record.createdAt && record.createdAt < where.createdAt.lt)) return false;
  if (where.updatedAt?.lt && !(record.updatedAt && record.updatedAt < where.updatedAt.lt)) return false;
  if (where.deletedAt === null && record.deletedAt !== null && record.deletedAt !== undefined) return false;
  if (where.candidateId?.in && !where.candidateId.in.includes(record.candidateId)) return false;
  return true;
}

function buildModel(records: InMemoryRecord[]) {
  return {
    async findMany({ where, select }: any = {}) {
      const results = records.filter((record) => matchesWhere(record, where));
      if (select?.id) return results.map((record) => ({ id: record.id }));
      return results;
    },
  };
}

function buildRetentionClient(data: {
  tenants: Array<Pick<Tenant, 'id' | 'dataRetentionDays' | 'deletionMode'>>;
  agentRunLog?: InMemoryRecord[];
  match?: InMemoryRecord[];
  matchResult?: InMemoryRecord[];
  candidate?: InMemoryRecord[];
}): RetentionPrisma {
  return {
    tenant: {
      findMany: async () => data.tenants,
    },
    agentRunLog: buildModel(data.agentRunLog ?? []),
    match: buildModel(data.match ?? []),
    matchResult: buildModel(data.matchResult ?? []),
    candidate: buildModel(data.candidate ?? []),
    candidateSkill: { deleteMany: async () => ({ count: 0 }) } as any,
    jobCandidate: { deleteMany: async () => ({ count: 0 }) } as any,
    outreachInteraction: { deleteMany: async () => ({ count: 0 }) } as any,
    featureFlag: { deleteMany: async () => ({ count: 0 }) } as any,
    jobSkill: { deleteMany: async () => ({ count: 0 }) } as any,
    jobReq: { deleteMany: async () => ({ count: 0 }) } as any,
    customer: { deleteMany: async () => ({ count: 0 }) } as any,
    tenantSubscription: { deleteMany: async () => ({ count: 0 }) } as any,
    user: { findMany: async () => [] } as any,
    userIdentity: { deleteMany: async () => ({ count: 0 }) } as any,
  } as unknown as RetentionPrisma;
}

const mockedComplianceAlert = vi.mocked(logComplianceAlert);
const mockedComplianceScan = vi.mocked(logComplianceScan);

describe('TS-A6 COMPLY agent', () => {
  const now = new Date('2024-04-01T00:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    __dangerousResetAuditTrail();
  });

  it('triggers retention alerts when expired records exist', async () => {
    const tenant = { id: 'tenant-a', dataRetentionDays: 30, deletionMode: TenantDeletionMode.HARD_DELETE };
    const prisma = buildRetentionClient({
      tenants: [tenant],
      agentRunLog: [
        { id: 'arl-old', tenantId: 'tenant-a', startedAt: daysAgo(now, 45), deletedAt: null },
        { id: 'arl-fresh', tenantId: 'tenant-a', startedAt: daysAgo(now, 1), deletedAt: null },
      ],
      candidate: [
        { id: 'cand-old', tenantId: 'tenant-a', updatedAt: daysAgo(now, 90), deletedAt: null },
        { id: 'cand-new', tenantId: 'tenant-a', updatedAt: daysAgo(now, 2), deletedAt: null },
      ],
    });

    const result = await runComplianceAgent({ prisma, tenant, now });

    expect(result.policy?.cutoff).toBeDefined();
    expect(result.expired?.candidateIds).toContain('cand-old');
    expect(result.alerts.some((alert) => alert.type === 'retention')).toBe(true);
    expect(mockedComplianceAlert).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', scope: 'tenant' }),
    );
    expect(mockedComplianceScan).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', alerts: result.alerts.length }),
    );
  });

  it('enforces tenant scope for classifications and access logging', async () => {
    const tenant = { id: 'tenant-scope', dataRetentionDays: null, deletionMode: TenantDeletionMode.SOFT_DELETE };
    const prisma = buildRetentionClient({ tenants: [tenant] });

    const result = await runComplianceAgent({
      prisma,
      tenant,
      dataAssets: [
        {
          id: 'asset-tenant',
          tenantId: 'tenant-scope',
          name: 'PII snapshot',
          content: 'Employee record for alice@example.com',
        },
        {
          id: 'asset-other',
          tenantId: 'other-tenant',
          name: 'Foreign data',
          content: 'This should never be scanned',
        },
      ],
      accessEvents: [
        { tenantId: 'tenant-scope', userId: 'user-1', resource: 'profile', action: 'view' },
        { tenantId: 'other-tenant', userId: 'user-2', resource: 'profile', action: 'edit' },
      ],
      now,
    });

    expect(result.classifications.map((c) => c.assetId)).toEqual(['asset-tenant']);
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]?.detail).toMatchObject({ assetId: 'asset-tenant' });

    const auditTrail = getAuditTrail();
    expect(auditTrail).toHaveLength(1);
    expect(auditTrail[0]?.metadata).toMatchObject({ tenantId: 'tenant-scope' });
    expect(mockedComplianceAlert).toHaveBeenCalledTimes(1);
  });
});
