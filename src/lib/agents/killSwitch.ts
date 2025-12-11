import { NextResponse } from 'next/server';

import {
  AGENT_KILL_SWITCHES,
  AgentDisabledError,
  type AgentName,
  describeAgent,
  enforceAgentFlagAvailability,
  getAgentFlagAvailability,
  listAgentFlagAvailability,
  parseAgentName,
  setAgentFlagAvailability,
} from './agentAvailability';

export { AGENT_KILL_SWITCHES, parseAgentName };

export type AgentKillSwitchRecord = {
  agentName: AgentName;
  latched: boolean;
  reason: string | null;
  latchedAt: Date | null;
  updatedAt: Date;
};

const DEFAULT_REASON = 'Disabled by admin';

function toKillSwitchRecord(record: { agentName: AgentName; enabled: boolean; updatedAt: Date }): AgentKillSwitchRecord {
  return {
    agentName: record.agentName,
    latched: !record.enabled,
    reason: record.enabled ? null : DEFAULT_REASON,
    latchedAt: record.enabled ? null : record.updatedAt,
    updatedAt: record.updatedAt,
  } satisfies AgentKillSwitchRecord;
}

export function describeAgentKillSwitch(name: AgentName) {
  return describeAgent(name);
}

export async function listAgentKillSwitches(tenantId?: string): Promise<AgentKillSwitchRecord[]> {
  const flags = await listAgentFlagAvailability(tenantId);

  return flags.map(toKillSwitchRecord);
}

export async function getAgentKillSwitchState(agentName: AgentName, tenantId?: string): Promise<AgentKillSwitchRecord> {
  const record = await getAgentFlagAvailability(agentName, tenantId);

  return toKillSwitchRecord(record);
}

export class AgentKillSwitchEngagedError extends AgentDisabledError {}

export async function assertAgentKillSwitchDisarmed(agentName: AgentName, tenantId?: string) {
  const state = await getAgentKillSwitchState(agentName, tenantId);

  if (state.latched) {
    throw new AgentKillSwitchEngagedError(agentName);
  }
}

export async function setAgentKillSwitch(
  agentName: AgentName,
  latched: boolean,
  _reason?: string | null,
  tenantId?: string,
): Promise<AgentKillSwitchRecord> {
  const updated = await setAgentFlagAvailability(agentName, !latched, tenantId);

  return toKillSwitchRecord({ ...updated, agentName });
}

export async function enforceAgentKillSwitch(agentName: AgentName, tenantId?: string) {
  const response = await enforceAgentFlagAvailability(agentName, tenantId);

  if (!response) return null;

  const label = describeAgent(agentName);

  return NextResponse.json(
    {
      error: `${label} is currently disabled`,
      reason: DEFAULT_REASON,
      latchedAt: (await getAgentKillSwitchState(agentName, tenantId)).latchedAt?.toISOString() ?? null,
    },
    { status: 503 },
  );
}
