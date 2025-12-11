import { afterEach, describe, expect, test, vi } from 'vitest';

import { logKillSwitchBlock, logKillSwitchChange } from '@/lib/audit/securityEvents';
import { prisma } from '@/lib/prisma';

import {
  AGENT_KILL_SWITCHES,
  AgentKillSwitchEngagedError,
  assertAgentKillSwitchDisarmed,
  enforceAgentKillSwitch,
  listAgentKillSwitches,
  parseAgentName,
  describeAgentKillSwitch,
  setAgentKillSwitch,
} from './killSwitch';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentFlag: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/audit/securityEvents', () => ({
  logKillSwitchChange: vi.fn(),
  logKillSwitchBlock: vi.fn(),
}));

afterEach(() => {
  vi.resetAllMocks();
});

describe('agent kill switch', () => {
  test('parses known agent names', () => {
    expect(parseAgentName(AGENT_KILL_SWITCHES.RINA)).toBe(AGENT_KILL_SWITCHES.RINA);
    expect(parseAgentName('unknown')).toBeNull();
    expect(parseAgentName(42)).toBeNull();
  });

  test('assertion throws when agent is latched', async () => {
    vi.mocked(prisma.agentFlag.findUnique).mockResolvedValue({
      id: 'af-1',
      agentName: AGENT_KILL_SWITCHES.RUA,
      enabled: false,
      tenantId: 'default-tenant',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    } as any);

    await expect(assertAgentKillSwitchDisarmed(AGENT_KILL_SWITCHES.RUA)).rejects.toBeInstanceOf(
      AgentKillSwitchEngagedError,
    );
  });

  test('enforce returns null when agent is available', async () => {
    vi.mocked(prisma.agentFlag.findUnique).mockResolvedValue({
      id: 'af-2',
      agentName: AGENT_KILL_SWITCHES.RINA,
      enabled: true,
      tenantId: 'default-tenant',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
    } as any);

    const response = await enforceAgentKillSwitch(AGENT_KILL_SWITCHES.RINA);

    expect(response).toBeNull();
  });

  test('assertion is silent when agent is not latched', async () => {
    vi.mocked(prisma.agentFlag.findUnique).mockResolvedValue({
      id: 'af-7',
      agentName: AGENT_KILL_SWITCHES.RUA,
      enabled: true,
      tenantId: 'default-tenant',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
    } as any);

    await expect(assertAgentKillSwitchDisarmed(AGENT_KILL_SWITCHES.RUA)).resolves.toBeUndefined();
  });

  test('enforce short-circuits when agent is disabled', async () => {
    vi.mocked(prisma.agentFlag.findUnique).mockResolvedValue({
      id: 'af-3',
      agentName: AGENT_KILL_SWITCHES.OUTREACH,
      enabled: false,
      tenantId: 'default-tenant',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
    } as any);

    const response = await enforceAgentKillSwitch(AGENT_KILL_SWITCHES.OUTREACH);

    expect(response?.status).toBe(503);

    const payload = await response?.json();
    expect(payload).toMatchObject({ reason: 'Disabled by admin' });
    expect(logKillSwitchBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        switchName: AGENT_KILL_SWITCHES.OUTREACH,
        reason: null,
        scope: 'agent',
      }),
    );
  });

  test('setAgentKillSwitch persists state', async () => {
    const expectedRecord = {
      id: 'af-4',
      agentName: AGENT_KILL_SWITCHES.RINA,
      enabled: false,
      tenantId: 'default-tenant',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
    };

    vi.mocked(prisma.agentFlag.upsert).mockResolvedValue(expectedRecord as any);

    const record = await setAgentKillSwitch(AGENT_KILL_SWITCHES.RINA, true, 'manual disable');

    expect(prisma.agentFlag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ enabled: false }),
        update: expect.objectContaining({ enabled: false }),
      }),
    );
    expect(record.agentName).toBe(AGENT_KILL_SWITCHES.RINA);
    expect(record.latched).toBe(true);
    expect(logKillSwitchChange).toHaveBeenCalledWith(
      expect.objectContaining({
        switchName: AGENT_KILL_SWITCHES.RINA,
        latched: true,
        reason: null,
        scope: 'agent',
      }),
    );
  });

  test('setAgentKillSwitch clears latched state', async () => {
    vi.mocked(prisma.agentFlag.upsert).mockResolvedValue({
      id: 'af-9',
      agentName: AGENT_KILL_SWITCHES.RINA,
      enabled: true,
      tenantId: 'default-tenant',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
    } as any);

    const record = await setAgentKillSwitch(AGENT_KILL_SWITCHES.RINA, false, 'ignored');

    expect(record.latched).toBe(false);
    expect(prisma.agentFlag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ enabled: true }),
        update: expect.objectContaining({ enabled: true }),
      }),
    );
    expect(logKillSwitchChange).toHaveBeenCalledWith(
      expect.objectContaining({
        switchName: AGENT_KILL_SWITCHES.RINA,
        latched: false,
        reason: null,
        latchedAt: null,
      }),
    );
  });

  test('listAgentKillSwitches returns defaults for missing records', async () => {
    vi.mocked(prisma.agentFlag.findMany).mockResolvedValue([
      {
        id: 'af-5',
        agentName: AGENT_KILL_SWITCHES.OUTREACH_AUTOMATION,
        enabled: false,
        tenantId: 'default-tenant',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      } as any,
    ]);

    const records = await listAgentKillSwitches();
    const automation = records.find((record) => record.agentName === AGENT_KILL_SWITCHES.OUTREACH_AUTOMATION);
    const rua = records.find((record) => record.agentName === AGENT_KILL_SWITCHES.RUA);

    expect(records).toHaveLength(Object.keys(AGENT_KILL_SWITCHES).length);
    expect(automation?.latched).toBe(true);
    expect(rua?.latched).toBe(false);
  });

  test('describeAgentKillSwitch maps known and unknown labels', () => {
    expect(describeAgentKillSwitch(AGENT_KILL_SWITCHES.RINA)).toBe('Resume parser (RINA)');
    expect(describeAgentKillSwitch(AGENT_KILL_SWITCHES.RUA)).toBe('Job parser (RUA)');
    expect(describeAgentKillSwitch(AGENT_KILL_SWITCHES.OUTREACH_AUTOMATION)).toBe(
      'Outreach automation',
    );
    expect(describeAgentKillSwitch(AGENT_KILL_SWITCHES.INTAKE)).toBe('Job intake parser');
    expect(describeAgentKillSwitch(AGENT_KILL_SWITCHES.RANKER)).toBe('Shortlist ranker');
    expect(describeAgentKillSwitch('unknown' as any)).toBe('unknown');
  });

  test('enforceAgentKillSwitch supplies default reason when missing', async () => {
    vi.mocked(prisma.agentFlag.findUnique).mockResolvedValue({
      id: 'af-8',
      agentName: AGENT_KILL_SWITCHES.OUTREACH,
      enabled: false,
      tenantId: 'default-tenant',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
    } as any);

    const response = await enforceAgentKillSwitch(AGENT_KILL_SWITCHES.OUTREACH);

    expect(await response?.json()).toMatchObject({ reason: 'Disabled by admin' });
  });
});
