/// <reference types="vitest/globals" />

import { runRua } from '@/lib/agents/rua';
import { RUA_PROMPT_VERSION, RUA_SYSTEM_PROMPT } from '@/lib/agents/contracts/ruaContract';
import { prisma } from '@/lib/prisma';
import { MockOpenAIAdapter } from '@/lib/llm/mockOpenAIAdapter';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentPrompt: {
      findUnique: vi.fn(async () => null),
      findFirst: vi.fn(async () => null),
      upsert: vi.fn(async () => ({
        id: 'prompt-rua',
        agentName: 'ETE-TS.RUA',
        version: RUA_PROMPT_VERSION,
        prompt: RUA_SYSTEM_PROMPT,
        active: true,
        rollbackVersion: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      })),
      updateMany: vi.fn(),
    },
    jobReq: {
      create: vi.fn(),
    },
  },
  isTableAvailable: vi.fn(async () => true),
}));

vi.mock('@/lib/agents/agentRun', () => ({
  withAgentRun: vi.fn(async (_meta, handler) => {
    const outcome = await handler();
    return [outcome.result, 'agent-run-rua'];
  }),
}));

describe('RUA contract enforcement', () => {
  const mockAdapter = new MockOpenAIAdapter();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter.reset();
  });

  it('throws when the LLM output breaks the schema', async () => {
    mockAdapter.enqueue(
      JSON.stringify({
        clientName: null,
        title: 'Backend Engineer',
        seniorityLevel: null,
        location: null,
        remoteType: null,
        employmentType: null,
        responsibilitiesSummary: null,
        teamContext: null,
        priority: null,
        status: null,
        ambiguityScore: 2,
        skills: [
          { name: 'Node.js', normalizedName: 'Node.js', isMustHave: true },
        ],
      }),
    );

    await expect(
      runRua(
        {
          rawJobText: 'An open role',
        },
        undefined,
        mockAdapter,
      ),
    ).rejects.toThrow(/schema validation/);

    expect(prisma.jobReq.create).not.toHaveBeenCalled();
  });
});
