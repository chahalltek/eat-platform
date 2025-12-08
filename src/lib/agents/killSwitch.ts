import type { AgentKillSwitch as AgentKillSwitchModel } from '@prisma/client';
import { NextResponse } from 'next/server';

import { logKillSwitchChange } from '@/lib/audit/securityEvents';
import { prisma } from '@/lib/prisma';

export const AGENT_KILL_SWITCHES = {
  MATCHER: 'EAT-TS.MATCHER',
  RANKER: 'EAT-TS.RANKER',
  RINA: 'EAT-TS.RINA',
  RUA: 'EAT-TS.RUA',
  OUTREACH: 'EAT-TS.OUTREACH',
  OUTREACH_AUTOMATION: 'EAT-TS.OUTREACH_AUTOMATION',
} as const;

export type AgentName = (typeof AGENT_KILL_SWITCHES)[keyof typeof AGENT_KILL_SWITCHES];

export type AgentKillSwitchRecord = {
  agentName: AgentName;
  latched: boolean;
  reason: string | null;
  latchedAt: Date | null;
  updatedAt: Date;
};

const DEFAULT_REASON = 'Disabled by admin';

function normalizeReason(reason?: string | null) {
  const trimmed = reason?.trim();

  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }

  return DEFAULT_REASON;
}

function allAgentNames() {
  return Object.values(AGENT_KILL_SWITCHES) as AgentName[];
}

function buildFallbackRecord(agentName: AgentName): AgentKillSwitchRecord {
  return {
    agentName,
    latched: false,
    reason: null,
    latchedAt: null,
    updatedAt: new Date(0),
  } satisfies AgentKillSwitchRecord;
}

function toRecord(agentName: AgentName, model?: AgentKillSwitchModel | null): AgentKillSwitchRecord {
  if (!model) return buildFallbackRecord(agentName);

  return {
    agentName,
    latched: model.latched,
    reason: model.reason ?? null,
    latchedAt: model.latchedAt ?? null,
    updatedAt: model.updatedAt,
  } satisfies AgentKillSwitchRecord;
}

export function parseAgentName(value: unknown): AgentName | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  const candidates = allAgentNames();

  return (candidates.find((candidate) => candidate === normalized) as AgentName | undefined) ?? null;
}

export function describeAgentKillSwitch(name: AgentName) {
  switch (name) {
    case AGENT_KILL_SWITCHES.RINA:
      return 'Resume parser (RINA)';
    case AGENT_KILL_SWITCHES.RUA:
      return 'Job parser (RUA)';
    case AGENT_KILL_SWITCHES.OUTREACH:
      return 'Outreach writer';
    case AGENT_KILL_SWITCHES.OUTREACH_AUTOMATION:
      return 'Outreach automation';
    case AGENT_KILL_SWITCHES.RANKER:
      return 'Shortlist ranker';
    default:
      return name;
  }
}

export async function listAgentKillSwitches(): Promise<AgentKillSwitchRecord[]> {
  const stored = await prisma.agentKillSwitch.findMany();
  const storedByName = new Map(stored.map((record) => [record.agentName, record]));

  return allAgentNames().map((agentName) => toRecord(agentName, storedByName.get(agentName)));
}

export async function getAgentKillSwitchState(agentName: AgentName): Promise<AgentKillSwitchRecord> {
  const state = await prisma.agentKillSwitch.findUnique({ where: { agentName } });

  return toRecord(agentName, state);
}

export class AgentKillSwitchEngagedError extends Error {
  constructor(agentName: AgentName, reason: string) {
    super(`${agentName} is disabled via kill switch: ${reason}`);
    this.name = 'AgentKillSwitchEngagedError';
  }
}

export async function assertAgentKillSwitchDisarmed(agentName: AgentName) {
  const state = await getAgentKillSwitchState(agentName);

  if (state.latched) {
    throw new AgentKillSwitchEngagedError(agentName, state.reason ?? DEFAULT_REASON);
  }
}

export async function setAgentKillSwitch(
  agentName: AgentName,
  latched: boolean,
  reason?: string | null,
): Promise<AgentKillSwitchRecord> {
  const normalizedReason = latched ? normalizeReason(reason) : null;
  const latchedAt = latched ? new Date() : null;

  const record = await prisma.agentKillSwitch.upsert({
    where: { agentName },
    update: { latched, reason: normalizedReason, latchedAt },
    create: { agentName, latched, reason: normalizedReason, latchedAt },
  });

  const parsed = toRecord(agentName, record);

  await logKillSwitchChange({
    switchName: agentName,
    latched: parsed.latched,
    reason: parsed.reason,
    latchedAt: parsed.latchedAt,
    scope: 'agent',
  });

  return parsed;
}

export async function enforceAgentKillSwitch(agentName: AgentName) {
  const state = await getAgentKillSwitchState(agentName);

  if (!state.latched) return null;

  const label = describeAgentKillSwitch(agentName);

  return NextResponse.json(
    {
      error: `${label} is currently disabled`,
      reason: state.reason ?? DEFAULT_REASON,
      latchedAt: state.latchedAt?.toISOString() ?? null,
    },
    { status: 503 },
  );
}
