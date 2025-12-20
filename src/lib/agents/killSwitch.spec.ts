import { afterEach, describe, expect, test, vi } from 'vitest';

import { Prisma } from '@/server/db/prisma';
import { logKillSwitchBlock, logKillSwitchChange } from '@/lib/audit/securityEvents';
import { prisma } from '@/server/db/prisma';

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

const isTableAvailableMock = vi.hoisted(() => vi.fn().mockResolvedValue(true));
const stateMap = vi.hoisted(() => new Map<string, { enabled: boolean; updatedAt: Date }>());
const missingTableFlag = vi.hoisted(() => ({ throwMissingTable: false }));

vi.mock('@/server/db/prisma', async (importOriginal) => {
  const previousAllowConstruction = process.env.VITEST_PRISMA_ALLOW_CONSTRUCTION;
  process.env.VITEST_PRISMA_ALLOW_CONSTRUCTION = 'true';

  const actual = await importOriginal<typeof import('@/server/db/prisma')>();
  process.env.VITEST_PRISMA_ALLOW_CONSTRUCTION = previousAllowConstruction;

  return {
    ...actual,
    Prisma: actual.Prisma ?? (await import('@prisma/client')).Prisma,
    prisma: {
      agentFlag: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
    },
    isPrismaUnavailableError: () => false,
    isTableAvailable: isTableAvailableMock,
  };
});

vi.mock('./agentAvailability', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./agentAvailability')>();

  const getRecord = (agentName: string) =>
    stateMap.get(agentName) ?? { enabled: true, updatedAt: new Date('2024-01-01T00:00:00Z') };

  return {
    ...actual,
    AGENT_KILL_SWITCHES: actual.AGENT_KILL_SWITCHES,
    parseAgentName: actual.parseAgentName,
    describeAgent: actual.describeAgent,
    listAgentFlagAvailability: vi.fn(async () => {
      if (missingTableFlag.throwMissingTable) {
        return Object.values(actual.AGENT_KILL_SWITCHES).map((agentName) => ({
          agentName,
          enabled: true,
          updatedAt: new Date('2024-01-01T00:00:00Z'),
        }));
      }

      return Object.values(actual.AGENT_KILL_SWITCHES).map((agentName) => ({
        agentName,
        ...getRecord(agentName),
      }));
    }),
    getAgentFlagAvailability: vi.fn(async (agentName: any) => ({ agentName, ...getRecord(agentName) })),
    setAgentFlagAvailability: vi.fn(async (agentName: any, enabled: boolean) => {
      const record = { enabled, updatedAt: new Date('2024-01-02T00:00:00Z') };
      stateMap.set(agentName, record);
      prisma.agentFlag.upsert?.({
        where: { tenantId_agentName: { tenantId: 'default-tenant', agentName } },
        update: { enabled },
        create: { tenantId: 'default-tenant', agentName, enabled },
      } as any);
      logKillSwitchChange({
        switchName: agentName,
        latched: !enabled,
        reason: null,
        latchedAt: enabled ? null : record.updatedAt,
        scope: 'agent',
      });
      return { agentName, ...record } as any;
    }),
    enforceAgentFlagAvailability: vi.fn(async (agentName: any) => {
      const record = getRecord(agentName);
      if (record.enabled) return null;

      logKillSwitchBlock({
        switchName: agentName,
        reason: null,
        latchedAt: record.updatedAt,
        scope: 'agent',
        tenantId: 'default-tenant',
        userId: 'user-1',
      });

      return new Response(null, { status: 503 });
    }),
  };
});

vi.mock('@/lib/audit/securityEvents', () => ({
  logKillSwitchChange: vi.fn(),
  logKillSwitchBlock: vi.fn(),
}));
vi.mock('@/lib/tenant', () => ({
  getCurrentTenantId: vi.fn(async () => 'default-tenant'),
}));
vi.mock('@/lib/auth/user', () => ({
  getCurrentUserId: vi.fn(async () => 'user-1'),
}));
vi.mock('@/lib/modes/loadTenantMode', () => ({
  loadTenantMode: vi.fn(async () => ({
    mode: 'production',
    guardrailsPreset: 'balanced',
    agentsEnabled: Object.values(AGENT_KILL_SWITCHES),
    source: 'mock',
  })),
}));

afterEach(() => {
  vi.resetAllMocks();
  isTableAvailableMock.mockResolvedValue(true);
  stateMap.clear();
  missingTableFlag.throwMissingTable = false;
});

describe('agent kill switch', () => {
  test('parses known agent names', () => {
    expect(parseAgentName(AGENT_KILL_SWITCHES.RINA)).toBe(AGENT_KILL_SWITCHES.RINA);
    expect(parseAgentName('unknown')).toBeNull();
    expect(parseAgentName(42)).toBeNull();
  });

  test('assertion throws when agent is latched', async () => {
    stateMap.set(AGENT_KILL_SWITCHES.RUA, {
      enabled: false,
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    });

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
    stateMap.set(AGENT_KILL_SWITCHES.OUTREACH, {
      enabled: false,
      updatedAt: new Date('2024-01-02T00:00:00Z'),
    });

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
    stateMap.set(AGENT_KILL_SWITCHES.OUTREACH_AUTOMATION, {
      enabled: false,
      updatedAt: new Date('2024-01-02T00:00:00Z'),
    });

    const records = await listAgentKillSwitches();
    const automation = records.find((record) => record.agentName === AGENT_KILL_SWITCHES.OUTREACH_AUTOMATION);
    const rua = records.find((record) => record.agentName === AGENT_KILL_SWITCHES.RUA);

    expect(records).toHaveLength(Object.keys(AGENT_KILL_SWITCHES).length);
    expect(automation?.latched).toBe(true);
    expect(rua?.latched).toBe(false);
  });

  test('listAgentKillSwitches falls back when AgentFlag table is missing', async () => {
    missingTableFlag.throwMissingTable = true;

    const records = await listAgentKillSwitches();

    expect(records).toHaveLength(Object.keys(AGENT_KILL_SWITCHES).length);
    expect(records.every((record) => record.latched === false)).toBe(true);
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
    stateMap.set(AGENT_KILL_SWITCHES.OUTREACH, {
      enabled: false,
      updatedAt: new Date('2024-01-02T00:00:00Z'),
    });

    const response = await enforceAgentKillSwitch(AGENT_KILL_SWITCHES.OUTREACH);

    expect(await response?.json()).toMatchObject({ reason: 'Disabled by admin' });
  });
});
