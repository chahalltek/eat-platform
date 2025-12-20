import { randomUUID } from "crypto";

const REDACT_PATTERNS = ["token", "secret", "password", "authorization", "cookie", "apiKey", "key"];

export const AUDIT_EVENT_TYPES = {
  AUTH: "AUTH",
  RBAC_DENY: "RBAC_DENY",
  AI_CALL: "AI_CALL",
  APPROVAL_REQUESTED: "APPROVAL_REQUESTED",
  APPROVAL_GRANTED: "APPROVAL_GRANTED",
  EXECUTION_BLOCKED: "EXECUTION_BLOCKED",
  EXECUTION_PERFORMED: "EXECUTION_PERFORMED",
  DATA_EXPORTED: "DATA_EXPORTED",
} as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[keyof typeof AUDIT_EVENT_TYPES];

type SanitizedMetadata = Record<string, unknown>;

type LogAuditEventInput = {
  eventType: AuditEventType;
  tenantId?: string | null;
  actorId?: string | null;
  subjectId?: string | null;
  featureFlag?: string | null;
  reason?: string | null;
  status?: "STARTED" | "SUCCESS" | "FAILED" | "BLOCKED";
  context?: Record<string, unknown> | undefined;
};

function redactValue(value: unknown, keyPath: string): unknown {
  if (value === undefined || value === null) return value;

  if (typeof value === "string") {
    const lowerKey = keyPath.toLowerCase();
    if (REDACT_PATTERNS.some((pattern) => lowerKey.includes(pattern))) {
      return `[redacted:${value.length}chars]`;
    }

    if (value.length > 120) {
      return `[truncated:${value.length}chars]`;
    }

    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.map((entry, index) => redactValue(entry, `${keyPath}[${index}]`));
  }

  if (typeof value === "object") {
    return sanitizeMetadata(value as Record<string, unknown>, keyPath);
  }

  return `[redacted:${typeof value}]`;
}

function sanitizeMetadata(metadata: Record<string, unknown>, parentKey = ""): SanitizedMetadata {
  return Object.entries(metadata).reduce<SanitizedMetadata>((acc, [key, value]) => {
    if (value === undefined) return acc;

    const keyPath = parentKey ? `${parentKey}.${key}` : key;
    acc[key] = redactValue(value, keyPath);
    return acc;
  }, {});
}

function toStructuredPayload({
  eventType,
  tenantId,
  actorId,
  subjectId,
  reason,
  featureFlag,
  status,
  context,
}: LogAuditEventInput) {
  return {
    auditEventId: randomUUID(),
    timestamp: new Date().toISOString(),
    eventType,
    tenantId: tenantId ?? null,
    actorId: actorId ?? null,
    subjectId: subjectId ?? null,
    featureFlag: featureFlag ?? null,
    reason: reason ?? null,
    status: status ?? "SUCCESS",
    context: context ? sanitizeMetadata(context) : undefined,
  };
}

export function logAuditEvent(input: LogAuditEventInput) {
  const payload = toStructuredPayload(input);

  console.log(JSON.stringify({ level: "info", channel: "audit", ...payload }));
}

export function logAiCall(params: {
  tenantId?: string | null;
  actorId?: string | null;
  agent: string;
  model: string;
  systemPromptChars: number;
  userPromptChars: number;
  status: "SUCCESS" | "FAILED";
  error?: string;
}) {
  logAuditEvent({
    eventType: AUDIT_EVENT_TYPES.AI_CALL,
    tenantId: params.tenantId,
    actorId: params.actorId,
    status: params.status,
    context: {
      agent: params.agent,
      model: params.model,
      systemPromptChars: params.systemPromptChars,
      userPromptChars: params.userPromptChars,
      error: params.error ?? undefined,
    },
  });
}

export function logExecutionBlocked(params: {
  tenantId?: string | null;
  actorId?: string | null;
  featureFlag: string;
  reason?: string | null;
  subjectId?: string | null;
}) {
  logAuditEvent({
    eventType: AUDIT_EVENT_TYPES.EXECUTION_BLOCKED,
    tenantId: params.tenantId,
    actorId: params.actorId,
    featureFlag: params.featureFlag,
    reason: params.reason ?? null,
    subjectId: params.subjectId ?? null,
    status: "BLOCKED",
  });
}

export function logDataExport(params: {
  tenantId?: string | null;
  actorId?: string | null;
  exportType: string;
  objectIds?: string[];
  recordCount?: number | null;
}) {
  logAuditEvent({
    eventType: AUDIT_EVENT_TYPES.DATA_EXPORTED,
    tenantId: params.tenantId,
    actorId: params.actorId,
    context: {
      exportType: params.exportType,
      objectIds: params.objectIds ?? [],
      recordCount: params.recordCount ?? null,
    },
  });
}
