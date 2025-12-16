import { Prisma } from '@/server/db';

import { getCurrentUserId } from '@/lib/auth/user';
import { prisma } from '@/server/db';
import { getCurrentTenantId } from '@/lib/tenant';

export const ADMIN_AUDIT_ACTIONS = {
  MODE_CHANGED: 'MODE_CHANGED',
  GUARDRAILS_UPDATED: 'GUARDRAILS_UPDATED',
  AGENT_FLAG_TOGGLED: 'AGENT_FLAG_TOGGLED',
<<<<<<< ours
<<<<<<< ours
  FEATURE_FLAG_TOGGLED: 'FEATURE_FLAG_TOGGLED',
=======
  KILL_SWITCH_TOGGLED: 'KILL_SWITCH_TOGGLED',
>>>>>>> theirs
=======
  FEATURE_FLAG_TOGGLED: 'FEATURE_FLAG_TOGGLED',
>>>>>>> theirs
} as const;

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[keyof typeof ADMIN_AUDIT_ACTIONS];

export type AuditLogRecord = {
  id: string;
  tenantId: string;
  actorId: string | null;
  action: AdminAuditAction;
  meta: Record<string, unknown> | null;
  createdAt: Date;
};

export type AuditLogFilters = {
  tenantId?: string;
  actions?: AdminAuditAction[];
  since?: Date;
  actorId?: string;
  limit?: number;
};

export type AuditLogInput = {
  tenantId?: string;
  actorId?: string | null;
  action: AdminAuditAction;
  meta?: Record<string, unknown> | null;
};

function sanitizeMeta(meta?: Record<string, unknown> | null): Prisma.InputJsonValue | undefined {
  if (!meta) return undefined;

  const entries = Object.entries(meta).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as Record<string, Prisma.InputJsonValue>;
}

function normalizeMeta(meta: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return null;
  }

  return meta as Record<string, unknown>;
}

async function resolveContext(tenantId?: string, actorId?: string | null) {
  const [resolvedTenantId, resolvedActorId] = await Promise.all([
    tenantId ?? getCurrentTenantId(),
    actorId ?? getCurrentUserId(),
  ]);

  return { tenantId: resolvedTenantId, actorId: resolvedActorId };
}

export async function recordAuditLog({ tenantId, actorId, action, meta }: AuditLogInput): Promise<AuditLogRecord> {
  const context = await resolveContext(tenantId, actorId);

  const created = await prisma.auditLog.create({
    data: {
      tenantId: context.tenantId,
      actorId: context.actorId ?? null,
      action,
      meta: sanitizeMeta(meta ?? undefined),
    },
  });

  return {
    id: created.id,
    tenantId: created.tenantId,
    actorId: created.actorId,
    action: created.action as AdminAuditAction,
    meta: normalizeMeta(created.meta),
    createdAt: created.createdAt,
  } satisfies AuditLogRecord;
}

export async function listAuditLogs({
  tenantId,
  actions,
  since,
  actorId,
  limit = 100,
}: AuditLogFilters = {}): Promise<AuditLogRecord[]> {
  const resolvedTenantId = tenantId ?? (await getCurrentTenantId());
  const where: Prisma.AuditLogWhereInput = { tenantId: resolvedTenantId };

  if (actions?.length) {
    where.action = { in: actions };
  }

  if (since) {
    where.createdAt = { gte: since };
  }

  if (actorId) {
    where.actorId = actorId;
  }

  const maxLimit = Math.min(Math.max(limit, 1), 200);

  const entries = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: maxLimit,
  });

  return entries.map((entry) => ({
    id: entry.id,
    tenantId: entry.tenantId,
    actorId: entry.actorId,
    action: entry.action as AdminAuditAction,
    meta: normalizeMeta(entry.meta),
    createdAt: entry.createdAt,
  }));
}

export async function logModeChange(params: {
  tenantId?: string;
  actorId?: string | null;
  previousMode?: string | null;
  newMode: string;
}) {
  return recordAuditLog({
    ...params,
    action: ADMIN_AUDIT_ACTIONS.MODE_CHANGED,
    meta: {
      previousMode: params.previousMode ?? null,
      newMode: params.newMode,
    },
  });
}

export async function logGuardrailsUpdate(params: {
  tenantId?: string;
  actorId?: string | null;
  preset?: string | null;
  scoringStrategy: string;
  thresholds: Record<string, unknown>;
  explain: Record<string, unknown>;
  safety: Record<string, unknown>;
}) {
  return recordAuditLog({
    ...params,
    action: ADMIN_AUDIT_ACTIONS.GUARDRAILS_UPDATED,
    meta: {
      preset: params.preset ?? null,
      scoringStrategy: params.scoringStrategy,
      thresholds: params.thresholds,
      explain: params.explain,
      safety: params.safety,
    },
  });
}

export async function logAgentFlagToggle(params: {
  tenantId?: string;
  actorId?: string | null;
  agentName: string;
  latched: boolean;
  reason?: string | null;
  latchedAt?: string | null;
}) {
  return recordAuditLog({
    ...params,
    action: ADMIN_AUDIT_ACTIONS.AGENT_FLAG_TOGGLED,
    meta: {
      agentName: params.agentName,
      latched: params.latched,
      reason: params.reason ?? null,
      latchedAt: params.latchedAt ?? null,
    },
  });
}

<<<<<<< ours
<<<<<<< ours
export async function logFeatureFlagToggle(params: {
  tenantId?: string;
  actorId?: string | null;
  flagKey: string;
  enabled: boolean;
  scope: 'tenant' | 'global';
=======
export async function logFeatureFlagToggle(params: {
  tenantId?: string;
  actorId?: string | null;
  flagName: string;
  enabled: boolean;
  previousEnabled?: boolean | null;
>>>>>>> theirs
}) {
  return recordAuditLog({
    ...params,
    action: ADMIN_AUDIT_ACTIONS.FEATURE_FLAG_TOGGLED,
    meta: {
<<<<<<< ours
      flagKey: params.flagKey,
      enabled: params.enabled,
      scope: params.scope,
=======
export async function logKillSwitchToggle(params: {
  tenantId?: string;
  actorId?: string | null;
  key: string;
  latched: boolean;
  reason?: string | null;
  latchedAt?: string | null;
}) {
  return recordAuditLog({
    ...params,
    action: ADMIN_AUDIT_ACTIONS.KILL_SWITCH_TOGGLED,
    meta: {
      key: params.key,
      latched: params.latched,
      reason: params.reason ?? null,
      latchedAt: params.latchedAt ?? null,
>>>>>>> theirs
=======
      flagName: params.flagName,
      enabled: params.enabled,
      previousEnabled: params.previousEnabled ?? null,
>>>>>>> theirs
    },
  });
}
