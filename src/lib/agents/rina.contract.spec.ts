/// <reference types="vitest/globals" />

import { runRina } from '@/lib/agents/rina';
import { MockOpenAIAdapter } from '@/lib/llm/mockOpenAIAdapter';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
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
