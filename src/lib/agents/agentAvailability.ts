import type { AgentFlag as AgentFlagModel } from '@prisma/client';
import { NextResponse } from 'next/server';

import { logKillSwitchBlock, logKillSwitchChange } from '@/lib/audit/securityEvents';
import { prisma } from '@/lib/prisma';
import { getCurrentTenantId } from '@/lib/tenant';

export const AGENTS = {
  MATCHER: 'ETE-TS.MATCHER',
  RANKER: 'ETE-TS.RANKER',
  INTAKE: 'ETE-TS.INTAKE',
  RINA: 'ETE-TS.RINA',
  RUA: 'ETE-TS.RUA',
  OUTREACH: 'ETE-TS.OUTREACH',
  OUTREACH_AUTOMATION: 'ETE-TS.OUTREACH_AUTOMATION',
} as const;

export const AGENT_KILL_SWITCHES = AGENTS;
export type AgentName = (typeof AGENTS)[keyof typeof AGENTS];

export type AgentAvailabilityRecord = {
  agentName: AgentName;
  enabled: boolean;
  updatedAt: Date;
};

function allAgentNames() {
  return Object.values(AGENTS) as AgentName[];
}

function buildFallbackRecord(agentName: AgentName): AgentAvailabilityRecord {
  return {
    agentName,
    enabled: true,
    updatedAt: new Date(0),
  } satisfies AgentAvailabilityRecord;
}

function toRecord(agentName: AgentName, model?: AgentFlagModel | null): AgentAvailabilityRecord {
  if (!model) return buildFallbackRecord(agentName);

  return {
    agentName,
    enabled: model.enabled,
    updatedAt: model.updatedAt,
  } satisfies AgentAvailabilityRecord;
}

async function resolveTenantId(tenantId?: string) {
  if (tenantId) return tenantId;

  return getCurrentTenantId();
}

export function parseAgentName(value: unknown): AgentName | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  const candidates = allAgentNames();

  return (candidates.find((candidate) => candidate === normalized) as AgentName | undefined) ?? null;
}

export function describeAgent(agentName: AgentName) {
  switch (agentName) {
    case AGENTS.RINA:
      return 'Resume parser (RINA)';
    case AGENTS.RUA:
      return 'Job parser (RUA)';
    case AGENTS.INTAKE:
      return 'Job intake parser';
    case AGENTS.OUTREACH:
      return 'Outreach writer';
    case AGENTS.OUTREACH_AUTOMATION:
      return 'Outreach automation';
    case AGENTS.RANKER:
      return 'Shortlist ranker';
    default:
      return agentName;
  }
}

export async function listAgentAvailability(tenantId?: string): Promise<AgentAvailabilityRecord[]> {
  const resolvedTenantId = await resolveTenantId(tenantId);
  const stored = await prisma.agentFlag.findMany({ where: { tenantId: resolvedTenantId } });
  const storedByName = new Map(stored.map((record) => [record.agentName, record]));

  return allAgentNames().map((agentName) => toRecord(agentName, storedByName.get(agentName)));
}

export async function getAgentAvailability(agentName: AgentName, tenantId?: string): Promise<AgentAvailabilityRecord> {
  const resolvedTenantId = await resolveTenantId(tenantId);
  const record = await prisma.agentFlag.findUnique({ where: { tenantId_agentName: { tenantId: resolvedTenantId, agentName } } });

  return toRecord(agentName, record);
}

export async function setAgentAvailability(
  agentName: AgentName,
  enabled: boolean,
  tenantId?: string,
): Promise<AgentAvailabilityRecord> {
  const resolvedTenantId = await resolveTenantId(tenantId);
  const record = await prisma.agentFlag.upsert({
    where: { tenantId_agentName: { tenantId: resolvedTenantId, agentName } },
    update: { enabled },
    create: { tenantId: resolvedTenantId, agentName, enabled },
  });

  const parsed = toRecord(agentName, record);

  await logKillSwitchChange({
    switchName: agentName,
    latched: !parsed.enabled,
    reason: null,
    latchedAt: parsed.enabled ? null : parsed.updatedAt,
    scope: 'agent',
  });

  return parsed;
}

export async function isAgentEnabled(agentName: AgentName, tenantId?: string): Promise<boolean> {
  const record = await getAgentAvailability(agentName, tenantId);

  return record.enabled;
}

export async function isAgentDisabled(agentName: AgentName, tenantId?: string): Promise<boolean> {
  return !(await isAgentEnabled(agentName, tenantId));
}

export class AgentDisabledError extends Error {
  constructor(agentName: AgentName) {
    super(`${agentName} is disabled for this tenant`);
    this.name = 'AgentDisabledError';
  }
}

export async function assertAgentEnabled(agentName: AgentName, tenantId?: string) {
  const enabled = await isAgentEnabled(agentName, tenantId);

  if (!enabled) {
    throw new AgentDisabledError(agentName);
  }
}

export async function enforceAgentAvailability(agentName: AgentName, tenantId?: string) {
  const enabled = await isAgentEnabled(agentName, tenantId);

  if (enabled) return null;

  const label = describeAgent(agentName);
  const state = await getAgentAvailability(agentName, tenantId);

  await logKillSwitchBlock({
    switchName: agentName,
    reason: null,
    latchedAt: state.enabled ? null : state.updatedAt,
    scope: 'agent',
  });

  return NextResponse.json(
    {
      error: `${label} is currently disabled`,
      latchedAt: state.enabled ? null : state.updatedAt.toISOString(),
    },
    { status: 503 },
  );
}
