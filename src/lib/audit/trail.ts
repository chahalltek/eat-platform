import { createHash, randomUUID } from 'node:crypto';

export type AuditLogEvent = {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  previousHash: string | null;
  hash: string;
};

type AuditInput = Omit<AuditLogEvent, 'id' | 'timestamp' | 'previousHash' | 'hash'>;

const auditTrail: AuditLogEvent[] = [];

function canonicalizePayload(payload: AuditInput) {
  const orderedPayload: Record<string, unknown> = {};
  const payloadEntries = Object.entries(payload).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

  for (const [key, value] of payloadEntries) {
    orderedPayload[key] = value;
  }

  return orderedPayload;
}

function computeHash(previousHash: string | null, payload: AuditInput, timestamp: string) {
  const canonicalPayload = canonicalizePayload(payload);
  return createHash('sha256').update(JSON.stringify({ ...canonicalPayload, timestamp, previousHash })).digest('hex');
}

export async function recordAuditEvent(payload: AuditInput) {
  const timestamp = new Date().toISOString();
  const previousHash = auditTrail.at(-1)?.hash ?? null;
  const hash = computeHash(previousHash, payload, timestamp);

  const event: AuditLogEvent = Object.freeze({
    id: randomUUID(),
    timestamp,
    previousHash,
    hash,
    ...payload,
  });

  auditTrail.push(event);
  return event;
}

export function getAuditTrail(): AuditLogEvent[] {
  return structuredClone(auditTrail);
}

export function verifyAuditChain(): { valid: boolean; tamperedIndex: number | null } {
  for (let i = 0; i < auditTrail.length; i += 1) {
    const event = auditTrail[i];
    const recomputedHash = computeHash(event.previousHash, {
      action: event.action,
      metadata: event.metadata,
      resource: event.resource,
      resourceId: event.resourceId,
      userId: event.userId,
      ip: event.ip,
    }, event.timestamp);

    const previousHash = i === 0 ? null : auditTrail[i - 1].hash;

    if (event.hash !== recomputedHash || event.previousHash !== previousHash) {
      return { valid: false, tamperedIndex: i };
    }
  }

  return { valid: true, tamperedIndex: null };
}

// Test-only utilities to keep the public API immutable while enabling integrity assertions.
export function __dangerousResetAuditTrail() {
  auditTrail.length = 0;
}

export function __dangerousTamperLatestForTests(mutator: (event: AuditLogEvent) => AuditLogEvent) {
  const latest = auditTrail.at(-1);
  if (!latest) return;

  auditTrail[auditTrail.length - 1] = mutator(latest);
}
