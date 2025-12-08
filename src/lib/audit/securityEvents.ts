import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth/user';
import { getCurrentTenantId } from '@/lib/tenant';

export const SECURITY_EVENT_TYPES = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  ROLE_CHANGED: 'ROLE_CHANGED',
  PLAN_CHANGED: 'PLAN_CHANGED',
  DATA_EXPORT_REQUESTED: 'DATA_EXPORT_REQUESTED',
  RETENTION_JOB_RUN: 'RETENTION_JOB_RUN',
  RATE_LIMIT_THRESHOLD: 'RATE_LIMIT_THRESHOLD',
  COMPLIANCE_ALERT: 'COMPLIANCE_ALERT',
  COMPLIANCE_SCAN: 'COMPLIANCE_SCAN',
  KILL_SWITCH_UPDATED: 'KILL_SWITCH_UPDATED',
} as const;

export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[keyof typeof SECURITY_EVENT_TYPES];

export type SecurityEventRecord = {
  id: string;
  tenantId: string;
  userId: string | null;
  eventType: SecurityEventType;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

type SecurityEventInput = {
  tenantId?: string;
  userId?: string | null;
  eventType: SecurityEventType;
  metadata?: Record<string, unknown>;
};

function sanitizeMetadata(metadata?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!metadata) return undefined;

  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
  const sanitized = Object.fromEntries(entries) as Record<string, Prisma.InputJsonValue>;

  return sanitized;
}

function normalizeMetadata(metadata: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  return metadata as Record<string, unknown>;
}

async function resolveContext(tenantId?: string, userId?: string | null) {
  const [resolvedTenantId, resolvedUserId] = await Promise.all([
    tenantId ?? getCurrentTenantId(),
    userId ?? getCurrentUserId(),
  ]);

  return {
    tenantId: resolvedTenantId,
    userId: resolvedUserId,
  };
}

async function recordSecurityEvent({ tenantId, userId, eventType, metadata }: SecurityEventInput) {
  const context = await resolveContext(tenantId, userId);
  const payload: Prisma.SecurityEventLogUncheckedCreateInput = {
    tenantId: context.tenantId,
    userId: context.userId,
    eventType,
    metadata: sanitizeMetadata(metadata),
  };

  const event = await prisma.securityEventLog.create({ data: payload });

  return {
    id: event.id,
    tenantId: event.tenantId,
    userId: event.userId,
    eventType: event.eventType as SecurityEventType,
    metadata: normalizeMetadata(event.metadata),
    createdAt: event.createdAt,
  } satisfies SecurityEventRecord;
}

export async function logLoginSuccess(params: {
  tenantId?: string;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  return recordSecurityEvent({
    ...params,
    eventType: SECURITY_EVENT_TYPES.LOGIN_SUCCESS,
    metadata: {
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    },
  });
}

export async function logLoginFailure(params: {
  tenantId?: string;
  userId?: string | null;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  return recordSecurityEvent({
    ...params,
    eventType: SECURITY_EVENT_TYPES.LOGIN_FAILURE,
    metadata: {
      reason: params.reason ?? null,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    },
  });
}

export async function logRoleChanged(params: {
  tenantId?: string;
  userId?: string | null;
  targetUserId: string;
  previousRole: string;
  newRole: string;
}) {
  return recordSecurityEvent({
    ...params,
    eventType: SECURITY_EVENT_TYPES.ROLE_CHANGED,
    metadata: {
      targetUserId: params.targetUserId,
      previousRole: params.previousRole,
      newRole: params.newRole,
    },
  });
}

export async function logPlanChanged(params: {
  tenantId?: string;
  userId?: string | null;
  previousPlan: string | null;
  newPlan: string;
}) {
  return recordSecurityEvent({
    ...params,
    eventType: SECURITY_EVENT_TYPES.PLAN_CHANGED,
    metadata: {
      previousPlan: params.previousPlan,
      newPlan: params.newPlan,
    },
  });
}

export async function logDataExportRequested(params: {
  tenantId?: string;
  userId?: string | null;
  exportType: string;
  destination?: string | null;
  format?: string | null;
}) {
  return recordSecurityEvent({
    ...params,
    eventType: SECURITY_EVENT_TYPES.DATA_EXPORT_REQUESTED,
    metadata: {
      exportType: params.exportType,
      destination: params.destination,
      format: params.format,
    },
  });
}

export async function logRetentionJobRun(params: {
  tenantId?: string;
  userId?: string | null;
  jobName: string;
  deletedRecords?: number | null;
  retainedRecords?: number | null;
  details?: Record<string, unknown>;
}) {
  return recordSecurityEvent({
    ...params,
    eventType: SECURITY_EVENT_TYPES.RETENTION_JOB_RUN,
    metadata: {
      jobName: params.jobName,
      deletedRecords: params.deletedRecords,
      retainedRecords: params.retainedRecords,
      details: params.details,
    },
  });
}

export async function logRateLimitThreshold(params: {
  tenantId?: string;
  userId?: string | null;
  action: string;
  reason: string;
  limit?: number | null;
  retryAfterMs: number;
}) {
  return recordSecurityEvent({
    ...params,
    eventType: SECURITY_EVENT_TYPES.RATE_LIMIT_THRESHOLD,
    metadata: {
      action: params.action,
      reason: params.reason,
      limit: params.limit ?? null,
      retryAfterMs: params.retryAfterMs,
    },
  });
}

export async function logComplianceAlert(params: {
  tenantId?: string;
  userId?: string | null;
  scope: string;
  violations: Array<{ type: string; detail?: Record<string, unknown> }>;
  severity?: 'low' | 'medium' | 'high';
}) {
  return recordSecurityEvent({
    ...params,
    eventType: SECURITY_EVENT_TYPES.COMPLIANCE_ALERT,
    metadata: {
      scope: params.scope,
      violations: params.violations,
      severity: params.severity ?? 'medium',
    },
  });
}

export async function logComplianceScan(params: {
  tenantId?: string;
  userId?: string | null;
  checks: string[];
  alerts: number;
  windowStartedAt: string;
  windowEndedAt: string;
}) {
  return recordSecurityEvent({
    ...params,
    eventType: SECURITY_EVENT_TYPES.COMPLIANCE_SCAN,
    metadata: {
      checks: params.checks,
      alerts: params.alerts,
      windowStartedAt: params.windowStartedAt,
      windowEndedAt: params.windowEndedAt,
         },
  });
}

export async function logKillSwitchChange(params: {
  tenantId?: string;
  userId?: string | null;
  switchName: string;
  latched: boolean;
  reason?: string | null;
  latchedAt?: Date | null;
  scope?: 'agent' | 'system';
}) {
  return recordSecurityEvent({
    ...params,
    eventType: SECURITY_EVENT_TYPES.KILL_SWITCH_UPDATED,
    metadata: {
      switchName: params.switchName,
      latched: params.latched,
      reason: params.reason ?? null,
      latchedAt: params.latchedAt?.toISOString() ?? null,
      scope: params.scope ?? 'system',
    },
  });
}

export async function listSecurityEvents(limit = 100, tenantId?: string): Promise<SecurityEventRecord[]> {
  const resolvedTenantId = tenantId ?? (await getCurrentTenantId());

  const events = await prisma.securityEventLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    where: { tenantId: resolvedTenantId },
  });

  return events.map((event) => ({
    id: event.id,
    tenantId: event.tenantId,
    userId: event.userId,
    eventType: event.eventType as SecurityEventType,
    metadata: normalizeMetadata(event.metadata),
    createdAt: event.createdAt,
  }));
}
