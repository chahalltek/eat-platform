/// <reference types="vitest/globals" />

import { runRua } from '@/lib/agents/rua';
import { prisma } from '@/lib/prisma';
import { MockOpenAIAdapter } from '@/lib/llm/mockOpenAIAdapter';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    jobReq: {
      create: vi.fn(),
    },
  },
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
