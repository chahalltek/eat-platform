import type { Tenant } from '@/server/db/prisma';

import { AGENT_KILL_SWITCHES } from '@/lib/agents/killSwitch';
import type { AgentName } from '@/lib/agents/agentAvailability';

export type GuardrailsSettings = {
  preset: string;
  isSet?: boolean | null;
  [key: string]: unknown;
};

export type TenantGuardrailsConfig = {
  mode?: string | null;
  guardrails?: GuardrailsSettings | null;
  agentKillSwitches?: Partial<Record<AgentName, boolean>> | null;
};

export type ResolvedTenantGuardrails = {
  tenantId: string;
  tenantName: string;
  mode: string;
  guardrails: GuardrailsSettings;
  agentKillSwitches: Record<AgentName, boolean>;
};

const AGENT_KILL_SWITCH_PREFIX = 'AGENT_KILL_SWITCH_';

function normalizeBoolean(value?: string | null) {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;

  return null;
}

function buildKillSwitchEnvKey(agentName: AgentName) {
  const sanitizedName = agentName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
  return `${AGENT_KILL_SWITCH_PREFIX}${sanitizedName}`;
}

export function loadTenantName(tenant: Pick<Tenant, 'id' | 'name'>) {
  const normalizedName = tenant.name?.trim();
  return normalizedName && normalizedName.length > 0 ? normalizedName : tenant.id;
}

export function loadGuardrailsPreset(mode?: string | null): GuardrailsSettings {
  const preset = mode?.trim();
  return { preset: preset && preset.length > 0 ? preset : 'default', isSet: false } satisfies GuardrailsSettings;
}

export function loadAgentKillSwitchesFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return Object.values(AGENT_KILL_SWITCHES).reduce<Partial<Record<AgentName, boolean>>>((acc, agentName) => {
    const envValue = env[buildKillSwitchEnvKey(agentName)];
    const parsed = normalizeBoolean(envValue);

    if (parsed !== null) {
      acc[agentName] = parsed;
    }

    return acc;
  }, {});
}

function resolveAgentKillSwitches(
  tenantKillSwitches: TenantGuardrailsConfig['agentKillSwitches'],
  envKillSwitches: Partial<Record<AgentName, boolean>>,
) {
  return Object.values(AGENT_KILL_SWITCHES).reduce<Record<AgentName, boolean>>((acc, agentName) => {
    const tenantOverride = tenantKillSwitches?.[agentName];
    const envDefault = envKillSwitches[agentName];

    if (tenantOverride !== undefined && tenantOverride !== null) {
      acc[agentName] = tenantOverride;
    } else if (envDefault !== undefined) {
      acc[agentName] = envDefault;
    } else {
      acc[agentName] = false;
    }

    return acc;
  }, {} as Record<AgentName, boolean>);
}

function resolveGuardrailsSettings(guardrails: GuardrailsSettings | null | undefined, preset: GuardrailsSettings) {
  if (!guardrails) return preset;
  if (guardrails.isSet) return { ...preset, ...guardrails } satisfies GuardrailsSettings;
  return preset;
}

export function loadTenantConfig(
  tenant: Pick<Tenant, 'id' | 'name'>,
  tenantConfig: TenantGuardrailsConfig | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedTenantGuardrails {
  const tenantName = loadTenantName(tenant);
  const mode = tenantConfig?.mode?.trim() || tenantName;
  const preset = loadGuardrailsPreset(mode);
  const guardrails = resolveGuardrailsSettings(tenantConfig?.guardrails, preset);
  const envKillSwitches = loadAgentKillSwitchesFromEnv(env);
  const agentKillSwitches = resolveAgentKillSwitches(tenantConfig?.agentKillSwitches, envKillSwitches);

  return {
    tenantId: tenant.id,
    tenantName,
    mode,
    guardrails,
    agentKillSwitches,
  } satisfies ResolvedTenantGuardrails;
}

export function resolveGuardrailsInput<T extends { mode?: string | null }>(
  input: T,
  config: Pick<ResolvedTenantGuardrails, 'mode'>,
): T & { mode: string } {
  if (input.mode && input.mode.trim().length > 0) {
    return { ...input, mode: input.mode };
  }

  return { ...input, mode: config.mode };
}
