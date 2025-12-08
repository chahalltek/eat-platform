/// <reference types="vitest/globals" />

import { runRina } from '@/lib/agents/rina';
import { RINA_PROMPT_VERSION, RINA_SYSTEM_PROMPT } from '@/lib/agents/contracts/rinaContract';
import { MockOpenAIAdapter } from '@/lib/llm/mockOpenAIAdapter';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentPrompt: {
      findUnique: vi.fn(async () => null),
      findFirst: vi.fn(async () => null),
      upsert: vi.fn(async () => ({
        id: 'prompt-rina',
        agentName: 'EAT-TS.RINA',
        version: RINA_PROMPT_VERSION,
        prompt: RINA_SYSTEM_PROMPT,
        active: true,
        rollbackVersion: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      })),
      updateMany: vi.fn(),
    },
    candidate: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/agents/agentRun', () => ({
  withAgentRun: vi.fn(async (_meta, handler) => {
    const outcome = await handler();
    return [outcome.result, 'agent-run-ct'];
  }),
}));

describe('RINA contract enforcement', () => {
  const mockAdapter = new MockOpenAIAdapter();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter.reset();
  });

  it('fails fast when the LLM payload violates the schema', async () => {
    mockAdapter.enqueue(
      JSON.stringify({
        fullName: 'Invalid Payload',
        skills: [],
        parsingConfidence: 1.5,
        warnings: [],
      }),
    );

    await expect(
      runRina(
        {
          rawResumeText: 'Some resume text',
        },
        undefined,
        mockAdapter,
      ),
    ).rejects.toThrow(/schema validation/);

    expect(prisma.candidate.create).not.toHaveBeenCalled();
  });
});
