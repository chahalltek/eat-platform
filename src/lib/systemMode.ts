import { Prisma } from '@/server/db/prisma';

import { isPrismaUnavailableError, isTableAvailable, prisma } from './prisma';
import { getCurrentTenantId } from './tenant';

export const SYSTEM_MODES = {
  PILOT: 'pilot',
  PRODUCTION: 'production',
  SANDBOX: 'sandbox',
  DEMO: 'demo',
  FIRE_DRILL: 'fire_drill',
} as const;

export type SystemModeName = (typeof SYSTEM_MODES)[keyof typeof SYSTEM_MODES];

export type AgentEnablement = {
  basic: boolean;
  shortlist: boolean;
  agents: boolean;
};

export type SystemModeMetadata = {
  guardrailsPreset?: string;
  agentEnablement?: Partial<AgentEnablement>;
};

export type SystemModeState = {
  mode: SystemModeName;
  metadata: SystemModeMetadata;
  guardrailsPreset: string;
  agentEnablement: AgentEnablement;
};

export type SystemMode = SystemModeState;

const DEFAULT_MODE: SystemModeName = SYSTEM_MODES.PILOT;
const DEFAULT_GUARDRAILS_PRESET = 'human-vetted';
const DEFAULT_AGENT_ENABLEMENT: AgentEnablement = {
  basic: false,
  shortlist: false,
  agents: false,
};

const MODE_PRESETS: Record<SystemModeName, { guardrailsPreset: string; agentEnablement: AgentEnablement }> = {
  [SYSTEM_MODES.PILOT]: {
    guardrailsPreset: 'human-vetted',
    agentEnablement: { basic: true, shortlist: true, agents: false },
  },
  [SYSTEM_MODES.PRODUCTION]: {
    guardrailsPreset: 'most-restricted',
    agentEnablement: { basic: true, shortlist: false, agents: false },
  },
  [SYSTEM_MODES.SANDBOX]: {
    guardrailsPreset: 'default-lenient',
    agentEnablement: { basic: true, shortlist: true, agents: true },
  },
  [SYSTEM_MODES.DEMO]: {
    guardrailsPreset: 'demo-safe',
    agentEnablement: { basic: true, shortlist: true, agents: false },
  },
  [SYSTEM_MODES.FIRE_DRILL]: {
    guardrailsPreset: 'conservative',
    agentEnablement: { basic: false, shortlist: false, agents: false },
  },
};

function coerceMode(value?: string | null): SystemModeName {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';

  const supportedModes = Object.values(SYSTEM_MODES) as SystemModeName[];

  return (supportedModes.find((mode) => mode === normalized) as SystemModeName | undefined) ?? DEFAULT_MODE;
}

function normalizeAgentEnablement(source?: Partial<AgentEnablement>): AgentEnablement {
  return {
    basic: source?.basic ?? false,
    shortlist: source?.shortlist ?? false,
    agents: source?.agents ?? false,
  };
}

export async function getSystemMode(tenantId?: string): Promise<SystemModeState> {
  const resolvedTenantId = tenantId ?? (await getCurrentTenantId());

  const hasSystemModeTable = await isTableAvailable('SystemMode');
  const presetFallback = MODE_PRESETS[DEFAULT_MODE];

  if (!hasSystemModeTable) {
    return {
      mode: DEFAULT_MODE,
      metadata: {},
      guardrailsPreset: presetFallback.guardrailsPreset,
      agentEnablement: presetFallback.agentEnablement,
    } satisfies SystemModeState;
  }

  const systemModeModel = prisma.systemMode as typeof prisma.systemMode | undefined;

  if (!systemModeModel?.findFirst) {
    return {
      mode: DEFAULT_MODE,
      metadata: {},
      guardrailsPreset: presetFallback.guardrailsPreset,
      agentEnablement: presetFallback.agentEnablement,
    } satisfies SystemModeState;
  }

  const record = await systemModeModel
    .findFirst({ where: { tenantId: resolvedTenantId } })
    .catch((error) => {
      if (
        isPrismaUnavailableError(error) ||
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021')
      ) {
        return null;
      }

      throw error;
    });

  const modeName = coerceMode(record?.mode);
  const metadata = (record?.metadata as SystemModeMetadata | null) ?? {};

  const preset = MODE_PRESETS[modeName] ?? presetFallback;
  const guardrailsPreset = metadata.guardrailsPreset ?? preset.guardrailsPreset ?? DEFAULT_GUARDRAILS_PRESET;
  const agentEnablement = normalizeAgentEnablement(metadata.agentEnablement ?? preset.agentEnablement ?? DEFAULT_AGENT_ENABLEMENT);

  return {
    mode: modeName,
    metadata,
    guardrailsPreset,
    agentEnablement,
  } satisfies SystemModeState;
}
