import { Prisma, type AgentPrompt } from '@/server/db';

import { DEFAULT_TENANT_ID } from '@/lib/auth/config';
import { RINA_PROMPT_VERSION, RINA_SYSTEM_PROMPT } from '@/lib/agents/contracts/rinaContract';
import { RUA_PROMPT_VERSION, RUA_SYSTEM_PROMPT } from '@/lib/agents/contracts/ruaContract';
import { prisma } from '@/server/db';
import { assertTenantWithinLimits } from '@/lib/subscription/usageLimits';

export const AGENT_PROMPTS = {
  RINA_SYSTEM: 'ETE-TS.RINA',
  RUA_SYSTEM: 'ETE-TS.RUA',
} as const;

export type AgentPromptName = (typeof AGENT_PROMPTS)[keyof typeof AGENT_PROMPTS];

export type AgentPromptDefinition =
  & Pick<AgentPrompt, 'version' | 'prompt' | 'active' | 'rollbackVersion'>
  & { agentName: AgentPromptName };

const DEFAULT_PROMPTS: AgentPromptDefinition[] = [
  {
    agentName: AGENT_PROMPTS.RINA_SYSTEM,
    version: RINA_PROMPT_VERSION,
    prompt: RINA_SYSTEM_PROMPT,
    active: true,
    rollbackVersion: null,
  },
  {
    agentName: AGENT_PROMPTS.RUA_SYSTEM,
    version: RUA_PROMPT_VERSION,
    prompt: RUA_SYSTEM_PROMPT,
    active: true,
    rollbackVersion: null,
  },
];

function isMissingTableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2021';
  }

  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2021';
}

function selectDefaultPrompt(agentName: AgentPromptName, version?: string): AgentPromptDefinition {
  const candidates = DEFAULT_PROMPTS.filter((prompt) => prompt.agentName === agentName);

  if (!candidates.length) {
    throw new Error(`Unsupported agent prompt: ${agentName}`);
  }

  if (version) {
    const pinned = candidates.find((prompt) => prompt.version === version);
    if (pinned) return pinned;
  }

  return candidates.find((prompt) => prompt.active) ?? candidates[0];
}

function buildFallbackPrompt(definition: AgentPromptDefinition): AgentPrompt {
  return {
    id: `fallback-${definition.agentName}-${definition.version}`,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...definition,
  } satisfies AgentPrompt;
}

async function ensurePromptVersion(definition: AgentPromptDefinition): Promise<AgentPrompt> {
  if (!prisma.agentPrompt?.upsert) {
    return buildFallbackPrompt(definition);
  }

  try {
    return await prisma.agentPrompt.upsert({
      where: { agentName_version: { agentName: definition.agentName, version: definition.version } },
      update: {},
      create: definition,
    });
  } catch (error) {
    if (isMissingTableError(error)) {
      return buildFallbackPrompt(definition);
    }

    throw error;
  }
}

async function ensureAgentDefinitionCapacity(
  agentName: AgentPromptName,
  version: string,
  tenantId: string,
) {
  if (!prisma.agentPrompt?.findUnique) {
    await assertTenantWithinLimits(tenantId, 'createAgentDefinition');
    return;
  }

  try {
    const existing = await prisma.agentPrompt.findUnique({
      where: { agentName_version: { agentName, version } },
    });

    if (existing) return;
  } catch (error) {
    if (isMissingTableError(error)) return;

    throw error;
  }

  await assertTenantWithinLimits(tenantId, 'createAgentDefinition');
}

export async function registerPromptVersion(
  definition: AgentPromptDefinition,
  options: { tenantId?: string } = {},
): Promise<AgentPrompt> {
  const tenantId = options.tenantId ?? DEFAULT_TENANT_ID;

  await ensureAgentDefinitionCapacity(definition.agentName, definition.version, tenantId);
  return ensurePromptVersion(definition);
}

export async function activatePromptVersion(
  agentName: AgentPromptName,
  version: string,
  rollbackVersion?: string | null,
  options: { tenantId?: string } = {},
): Promise<AgentPrompt> {
  const tenantId = options.tenantId ?? DEFAULT_TENANT_ID;
  const fallbackDefinition = selectDefaultPrompt(agentName, version);
  const definition: AgentPromptDefinition = {
    ...fallbackDefinition,
    version,
    active: true,
    rollbackVersion: rollbackVersion ?? fallbackDefinition.rollbackVersion ?? null,
  };

  try {
    await ensureAgentDefinitionCapacity(agentName, version, tenantId);
    if (!prisma.agentPrompt?.updateMany || !prisma.agentPrompt?.upsert) {
      return buildFallbackPrompt(definition);
    }

    await prisma.agentPrompt.updateMany({
      where: { agentName },
      data: { active: false },
    });

    return await prisma.agentPrompt.upsert({
      where: { agentName_version: { agentName, version } },
      update: { active: true, rollbackVersion: definition.rollbackVersion },
      create: definition,
    });
  } catch (error) {
    if (isMissingTableError(error)) {
      return buildFallbackPrompt(definition);
    }

    throw error;
  }
}

export async function resolveAgentPrompt(
  agentName: AgentPromptName,
  { version }: { version?: string } = {},
): Promise<AgentPrompt> {
  const fallbackDefinition = selectDefaultPrompt(agentName, version);
  const agentPromptClient = prisma.agentPrompt;

  if (!agentPromptClient) {
    return buildFallbackPrompt(fallbackDefinition);
  }

  try {
    if (version) {
      const pinned = await agentPromptClient.findUnique({
        where: { agentName_version: { agentName, version } },
      });

      if (pinned) {
        return pinned;
      }

      return ensurePromptVersion(fallbackDefinition);
    }

    await ensurePromptVersion(fallbackDefinition);

    const active = await agentPromptClient.findFirst({
      where: { agentName, active: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (active) {
      return active;
    }

    return ensurePromptVersion(fallbackDefinition);
  } catch (error) {
    if (isMissingTableError(error)) {
      return buildFallbackPrompt(fallbackDefinition);
    }

    throw error;
  }
}
