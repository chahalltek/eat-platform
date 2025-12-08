import { Prisma, type AgentPrompt } from '@prisma/client';

import { RINA_PROMPT_VERSION, RINA_SYSTEM_PROMPT } from '@/lib/agents/contracts/rinaContract';
import { RUA_PROMPT_VERSION, RUA_SYSTEM_PROMPT } from '@/lib/agents/contracts/ruaContract';
import { prisma } from '@/lib/prisma';

export const AGENT_PROMPTS = {
  RINA_SYSTEM: 'EAT-TS.RINA',
  RUA_SYSTEM: 'EAT-TS.RUA',
} as const;

export type AgentPromptName = (typeof AGENT_PROMPTS)[keyof typeof AGENT_PROMPTS];

export type AgentPromptDefinition = Pick<AgentPrompt, 'agentName' | 'version' | 'prompt' | 'active' | 'rollbackVersion'>;

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

export async function registerPromptVersion(definition: AgentPromptDefinition): Promise<AgentPrompt> {
  return ensurePromptVersion(definition);
}

export async function activatePromptVersion(
  agentName: AgentPromptName,
  version: string,
  rollbackVersion?: string | null,
): Promise<AgentPrompt> {
  const fallbackDefinition = selectDefaultPrompt(agentName, version);
  const definition: AgentPromptDefinition = {
    ...fallbackDefinition,
    version,
    active: true,
    rollbackVersion: rollbackVersion ?? fallbackDefinition.rollbackVersion ?? null,
  };

  try {
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

  try {
    if (version) {
      const pinned = await prisma.agentPrompt.findUnique({
        where: { agentName_version: { agentName, version } },
      });

      if (pinned) {
        return pinned;
      }

      return ensurePromptVersion(fallbackDefinition);
    }

    await ensurePromptVersion(fallbackDefinition);

    const active = await prisma.agentPrompt.findFirst({
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
