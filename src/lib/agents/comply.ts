import { Tenant, TenantDeletionMode } from '@/server/db';

import { logComplianceAlert, logComplianceScan } from '@/lib/audit/securityEvents';
import { recordAuditEvent } from '@/lib/audit/trail';
import {
  findExpiredRecords,
  resolveRetentionPolicy,
  type ExpiredRecordSelection,
  type RetentionPolicy,
  type RetentionPrisma,
} from '@/lib/retention';

export type DataAsset = {
  id: string;
  tenantId: string;
  name: string;
  content: string;
  ownerId?: string | null;
  tags?: string[];
};

export type AccessEvent = {
  tenantId: string;
  userId: string;
  resource: string;
  action: string;
  resourceId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
  at?: Date;
};

export type ClassifiedAsset = {
  assetId: string;
  tenantId: string;
  classification: 'restricted' | 'confidential' | 'internal';
  evidence: string[];
};

export type ComplianceAlert = {
  tenantId: string;
  type: 'retention' | 'classification';
  message: string;
  severity: 'low' | 'medium' | 'high';
  detail?: Record<string, unknown>;
};

export type ComplianceResult = {
  tenantId: string;
  policy: RetentionPolicy | null;
  expired: ExpiredRecordSelection | null;
  classifications: ClassifiedAsset[];
  alerts: ComplianceAlert[];
  accessEventsLogged: number;
};

function normalizeAssetsForTenant(tenantId: string, assets: DataAsset[]): DataAsset[] {
  return assets.filter((asset) => asset.tenantId === tenantId);
}

function detectSensitiveSignals(content: string): string[] {
  const signals: string[] = [];

  if (/\b\d{3}[- )]?\d{2}[- ]?\d{4}\b/.test(content)) {
    signals.push('possible-ssn');
  }

  if (/\b\d{3}[- )]?\d{3}[- ]?\d{4}\b/.test(content)) {
    signals.push('possible-phone');
  }

  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(content)) {
    signals.push('possible-email');
  }

  const flaggedKeywords = ['password', 'secret', 'token', 'ssn'];
  const lowered = content.toLowerCase();
  flaggedKeywords.forEach((keyword) => {
    if (lowered.includes(keyword)) {
      signals.push(`keyword:${keyword}`);
    }
  });

  return Array.from(new Set(signals));
}

function classifyAsset(asset: DataAsset): ClassifiedAsset {
  const signals = detectSensitiveSignals(asset.content);

  const classification: ClassifiedAsset['classification'] = signals.length
    ? 'restricted'
    : asset.tags?.includes('public')
      ? 'internal'
      : 'confidential';

  return {
    assetId: asset.id,
    tenantId: asset.tenantId,
    classification,
    evidence: signals,
  };
}

async function logAccessEventsForTenant(events: AccessEvent[], tenantId: string) {
  const scopedEvents = events.filter((event) => event.tenantId === tenantId);
  await Promise.all(
    scopedEvents.map((event) =>
      recordAuditEvent({
        action: `access:${event.action}`,
        userId: event.userId,
        resource: event.resource,
        resourceId: event.resourceId,
        metadata: { tenantId, ...event.metadata },
        ip: event.ip,
      }),
    ),
  );

  return scopedEvents.length;
}

function summarizeExpired(expired: ExpiredRecordSelection | null) {
  if (!expired) return 0;

  return (
    expired.agentRunLogIds.length +
    expired.matchIds.length +
    expired.matchResultIds.length +
    expired.candidateIds.length
  );
}

async function evaluateRetention(
  prisma: RetentionPrisma,
  tenant: Pick<Tenant, 'id' | 'dataRetentionDays' | 'deletionMode'>,
  now: Date,
): Promise<{ policy: RetentionPolicy | null; expired: ExpiredRecordSelection | null; alerts: ComplianceAlert[] }> {
  const policy = resolveRetentionPolicy(tenant, now);

  if (!policy) {
    return { policy: null, expired: null, alerts: [] };
  }

  const expired = await findExpiredRecords(prisma, tenant.id, policy.cutoff);
  const totalExpired = summarizeExpired(expired);

  if (totalExpired === 0) {
    return { policy, expired, alerts: [] };
  }

  const retentionAlert: ComplianceAlert = {
    tenantId: tenant.id,
    type: 'retention',
    message: 'Expired records detected during compliance scan',
    severity: policy.mode === TenantDeletionMode.HARD_DELETE ? 'high' : 'medium',
    detail: {
      cutoff: policy.cutoff.toISOString(),
      expired,
      mode: policy.mode,
      totalExpired,
    },
  };

  await logComplianceAlert({
    tenantId: tenant.id,
    scope: 'tenant',
    violations: [{ type: 'retention', detail: retentionAlert.detail }],
    severity: retentionAlert.severity,
  });

  return { policy, expired, alerts: [retentionAlert] };
}

export async function runComplianceAgent(params: {
  prisma: RetentionPrisma;
  tenant: Pick<Tenant, 'id' | 'dataRetentionDays' | 'deletionMode'>;
  dataAssets?: DataAsset[];
  accessEvents?: AccessEvent[];
  now?: Date;
}): Promise<ComplianceResult> {
  const { prisma, tenant } = params;
  const now = params.now ?? new Date();
  const assets = normalizeAssetsForTenant(tenant.id, params.dataAssets ?? []);
  const accessEvents = params.accessEvents ?? [];

  const classifications = assets.map(classifyAsset);
  const classificationAlerts: ComplianceAlert[] = classifications
    .filter((asset) => asset.classification === 'restricted')
    .map((asset) => ({
      tenantId: tenant.id,
      type: 'classification',
      message: `Sensitive signals found in ${asset.assetId}`,
      severity: 'high',
      detail: { evidence: asset.evidence, assetId: asset.assetId },
    }));

  if (classificationAlerts.length) {
    await logComplianceAlert({
      tenantId: tenant.id,
      scope: 'tenant',
      violations: classificationAlerts.map((alert) => ({ type: alert.type, detail: alert.detail })),
      severity: 'high',
    });
  }

  const accessEventsLogged = await logAccessEventsForTenant(accessEvents, tenant.id);
  const retentionOutcome = await evaluateRetention(prisma, tenant, now);
  const alerts = [...classificationAlerts, ...retentionOutcome.alerts];

  await logComplianceScan({
    tenantId: tenant.id,
    checks: ['classification', 'retention', 'access'],
    alerts: alerts.length,
    windowStartedAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    windowEndedAt: now.toISOString(),
  });

  return {
    tenantId: tenant.id,
    policy: retentionOutcome.policy,
    expired: retentionOutcome.expired,
    classifications,
    alerts,
    accessEventsLogged,
  };
}

export async function runScheduledComplianceScan(
  prisma: RetentionPrisma,
  options: {
    assetsByTenant?: Record<string, DataAsset[]>;
    accessEventsByTenant?: Record<string, AccessEvent[]>;
    now?: Date;
  } = {},
) {
  const tenants = await prisma.tenant.findMany();
  const now = options.now ?? new Date();

  const results = await Promise.all(
    tenants.map((tenant) =>
      runComplianceAgent({
        prisma,
        tenant,
        dataAssets: options.assetsByTenant?.[tenant.id] ?? [],
        accessEvents: options.accessEventsByTenant?.[tenant.id] ?? [],
        now,
      }),
    ),
  );

  return {
    runAt: now.toISOString(),
    processed: tenants.length,
    alerts: results.reduce((count, result) => count + result.alerts.length, 0),
    results,
  };
}
