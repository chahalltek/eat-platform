/// <reference types="vitest/globals" />

import {
  __dangerousResetAuditTrail,
  __dangerousTamperLatestForTests,
  getAuditTrail,
  recordAuditEvent,
  verifyAuditChain,
} from './trail';

describe('audit trail', () => {
  beforeEach(() => {
    __dangerousResetAuditTrail();
  });

  it('records immutable, chained audit events', async () => {
    await recordAuditEvent({
      action: 'TEST_WRITE',
      resource: 'Unit',
      userId: 'user-1',
      metadata: { change: 'created' },
      ip: '127.0.0.1',
    });

    await recordAuditEvent({
      action: 'TEST_UPDATE',
      resource: 'Unit',
      resourceId: 'abc',
      userId: 'user-1',
      metadata: { change: 'mutated' },
      ip: '127.0.0.1',
    });

    const events = getAuditTrail();
    expect(events).toHaveLength(2);
    expect(events[1].previousHash).toBe(events[0].hash);

    // Mutating the copy should not affect the underlying chain.
    events[0].action = 'tampered';
    const integrity = verifyAuditChain();
    expect(integrity.valid).toBe(true);
    expect(integrity.tamperedIndex).toBeNull();
  });

  it('detects tampering attempts against the stored log', async () => {
    await recordAuditEvent({
      action: 'SAFE_ACTION',
      resource: 'Unit',
      userId: 'user-2',
    });

    __dangerousTamperLatestForTests((event) => ({ ...event, action: 'FORGED' }));
    const integrity = verifyAuditChain();

    expect(integrity.valid).toBe(false);
    expect(integrity.tamperedIndex).toBe(0);
  });
});
