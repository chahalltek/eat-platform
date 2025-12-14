/// <reference types="vitest/globals" />

import { runRina, type RinaInput } from '@/lib/agents/rina';
import { RINA_PROMPT_VERSION, RINA_SYSTEM_PROMPT } from '@/lib/agents/contracts/rinaContract';
import {
  AgentBehaviorSpec,
  formatBDDTitle,
  runAgentBehavior,
} from '@/lib/agents/testing/agentTestRunner';
import { enableDeterministicAgentMode } from './testing/deterministicAgentMode';
import { prisma } from '@/server/db';
import fixture from '../../../tests/fixtures/agents/rina-bdd.json';

const { mockCallLLM } = vi.hoisted(() => ({
  mockCallLLM: vi.fn(),
}));

vi.mock('@/lib/llm', () => ({ callLLM: mockCallLLM }));

vi.mock('@/server/db', () => {
  return {
    isTableAvailable: vi.fn(async () => true),
    prisma: {
      agentPrompt: {
        findUnique: vi.fn(async () => null),
        findFirst: vi.fn(async () => null),
        upsert: vi.fn(async () => ({
          id: 'prompt-rina',
          agentName: 'ETE-TS.RINA',
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
  };
});

vi.mock('@/lib/agents/agentRun', () => {
  return {
    withAgentRun: vi.fn(async (_meta, handler) => {
      const outcome = await handler();
      return [outcome.result, 'agent-run-001'];
    }),
  };
});

describe('RINA agent (BDD)', () => {
  const llmFixture = JSON.stringify(fixture.llmResponse);
  let deterministic: ReturnType<typeof enableDeterministicAgentMode>;

  beforeAll(() => {
    deterministic = enableDeterministicAgentMode({ llmFixtures: { RINA: llmFixture } });
    mockCallLLM.mockImplementation(deterministic.llmMock);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCallLLM.mockImplementation(deterministic.llmMock);
  });

  afterAll(() => {
    deterministic.restore();
  });

  it(
    formatBDDTitle({
      given: 'a raw resume containing a frontend engineer profile',
      when: 'RINA runs with a mocked LLM response',
      then: 'the candidate is persisted and the structured output matches snapshot',
    }),
    async () => {
      const candidateCreate = vi.mocked(prisma.candidate.create);
      candidateCreate.mockResolvedValue({
        id: 'candidate-123',
        ...fixture.llmResponse,
      });

      const spec: AgentBehaviorSpec<RinaInput, { candidateId: string; agentRunId: string }> = {
        clauses: {
          given: 'a raw resume containing a frontend engineer profile',
          when: 'RINA runs with a mocked LLM response',
          then: 'the candidate is persisted and the structured output matches snapshot',
        },
        given: {
          rawResumeText: fixture.rawResumeText,
          sourceType: 'upload',
          sourceTag: 'career-site',
        },
        when: (input) => runRina(input),
        snapshot: (result) => result,
        then: ({ result, snapshot }) => {
          expect(result.candidateId).toBe('candidate-123');
          expect(result.agentRunId).toBe('agent-run-001');

          expect(candidateCreate).toHaveBeenCalledTimes(1);
          snapshot(candidateCreate.mock.calls[0]?.[0], 'candidate write payload');
        },
      };

      await runAgentBehavior(spec);
    },
  );
});
