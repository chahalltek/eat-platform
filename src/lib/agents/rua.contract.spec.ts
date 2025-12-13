/// <reference types="vitest/globals" />

import { runRua } from '@/lib/agents/rua';
import { RUA_PROMPT_VERSION, RUA_SYSTEM_PROMPT } from '@/lib/agents/contracts/ruaContract';
import { enableDeterministicAgentMode } from './testing/deterministicAgentMode';
import { prisma } from '@/lib/prisma';
import fixture from '../../../tests/fixtures/agents/rua-invalid-llm.json';

const { mockCallLLM } = vi.hoisted(() => ({
  mockCallLLM: vi.fn(),
}));

vi.mock('@/lib/llm', () => ({ callLLM: mockCallLLM }));

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
  const llmFixture = JSON.stringify(fixture.llmResponse);
  let deterministic: ReturnType<typeof enableDeterministicAgentMode>;

  beforeAll(() => {
    deterministic = enableDeterministicAgentMode({ llmFixtures: { RUA: llmFixture } });
    mockCallLLM.mockImplementation(deterministic.llmMock);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCallLLM.mockImplementation(deterministic.llmMock);
  });

  afterAll(() => {
    deterministic.restore();
  });

  it('throws when the LLM output breaks the schema', async () => {
    await expect(
      runRua(
        {
          rawJobText: fixture.rawJobText,
        },
        undefined,
        undefined,
      ),
    ).rejects.toThrow(/schema validation/);

    expect(prisma.jobReq.create).not.toHaveBeenCalled();
  });
});
