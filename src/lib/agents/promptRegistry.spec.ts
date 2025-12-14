import { describe, expect, it, beforeEach, vi } from 'vitest';

import { AGENT_PROMPTS, resolveAgentPrompt } from '@/lib/agents/promptRegistry';
import { RINA_PROMPT_VERSION, RINA_SYSTEM_PROMPT } from '@/lib/agents/contracts/rinaContract';
import { RUA_PROMPT_VERSION, RUA_SYSTEM_PROMPT } from '@/lib/agents/contracts/ruaContract';
import type { AgentPrompt } from '@/server/db';

const agentPromptMock = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  upsert: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    agentPrompt: agentPromptMock,
  },
}));

function buildPromptRecord(overrides: Partial<AgentPrompt> = {}): AgentPrompt {
  return {
    id: 'agent-prompt-id',
    agentName: AGENT_PROMPTS.RINA_SYSTEM,
    version: RINA_PROMPT_VERSION,
    prompt: RINA_SYSTEM_PROMPT,
    active: true,
    rollbackVersion: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  } satisfies AgentPrompt;
}

describe('prompt registry', () => {
  beforeEach(() => {
    agentPromptMock.findUnique.mockReset();
    agentPromptMock.findFirst.mockReset();
    agentPromptMock.upsert.mockReset();
    agentPromptMock.updateMany.mockReset();
  });

  it('honors pinned prompt versions even when a different version is active', async () => {
    const activePrompt = buildPromptRecord({ version: 'v9.9.9', prompt: 'legacy prompt' });

    agentPromptMock.findUnique.mockResolvedValue(null);
    agentPromptMock.findFirst.mockResolvedValue(activePrompt);
    agentPromptMock.upsert.mockResolvedValue(buildPromptRecord());

    const prompt = await resolveAgentPrompt(AGENT_PROMPTS.RINA_SYSTEM, { version: RINA_PROMPT_VERSION });

    expect(prompt.version).toBe(RINA_PROMPT_VERSION);
    expect(prompt.prompt).toBe(RINA_SYSTEM_PROMPT);
    expect(agentPromptMock.findUnique).toHaveBeenCalledWith({
      where: { agentName_version: { agentName: AGENT_PROMPTS.RINA_SYSTEM, version: RINA_PROMPT_VERSION } },
    });
    expect(agentPromptMock.upsert).toHaveBeenCalled();
  });

  it('returns fallback defaults when the prompt table has not been migrated yet', async () => {
    const missingTableError = { code: 'P2021' };
    agentPromptMock.findUnique.mockRejectedValue(missingTableError);
    agentPromptMock.findFirst.mockRejectedValue(missingTableError);
    agentPromptMock.upsert.mockRejectedValue(missingTableError);

    const prompt = await resolveAgentPrompt(AGENT_PROMPTS.RUA_SYSTEM);

    expect(prompt.version).toBe(RUA_PROMPT_VERSION);
    expect(prompt.prompt).toBe(RUA_SYSTEM_PROMPT);
  });
});
