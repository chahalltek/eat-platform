/// <reference types="vitest/globals" />

import { runRina, type RinaInput } from '@/lib/agents/rina';
import {
  AgentBehaviorSpec,
  formatBDDTitle,
  runAgentBehavior,
} from '@/lib/agents/testing/agentTestRunner';
import { MockOpenAIAdapter } from '@/lib/llm/mockOpenAIAdapter';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => {
  return {
    prisma: {
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
  const mockAdapter = new MockOpenAIAdapter();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter.reset();
  });

  it(
    formatBDDTitle({
      given: 'a raw resume containing a frontend engineer profile',
      when: 'RINA runs with a mocked LLM response',
      then: 'the candidate is persisted and the structured output matches snapshot',
    }),
    async () => {
      const resumeText = `Jane Doe\nFrontend Engineer\nEmail: jane@example.com\nSkills: React, TypeScript`;

      const llmResponse = {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: null,
        location: null,
        currentTitle: 'Frontend Engineer',
        currentCompany: null,
        totalExperienceYears: 5,
        seniorityLevel: 'mid',
        summary: 'Frontend engineer focused on React and TypeScript.',
        skills: [
          {
            name: 'React',
            normalizedName: 'React',
            proficiency: 'advanced',
            yearsOfExperience: 4,
          },
          {
            name: 'TypeScript',
            normalizedName: 'TypeScript',
            proficiency: 'advanced',
            yearsOfExperience: 3,
          },
        ],
        parsingConfidence: 0.92,
        warnings: [],
      };

      mockAdapter.enqueue(JSON.stringify(llmResponse));

      const candidateCreate = vi.mocked(prisma.candidate.create);
      candidateCreate.mockResolvedValue({
        id: 'candidate-123',
        ...llmResponse,
      });

      const spec: AgentBehaviorSpec<RinaInput, { candidateId: string; agentRunId: string }> = {
        clauses: {
          given: 'a raw resume containing a frontend engineer profile',
          when: 'RINA runs with a mocked LLM response',
          then: 'the candidate is persisted and the structured output matches snapshot',
        },
        given: {
          rawResumeText: resumeText,
          sourceType: 'upload',
          sourceTag: 'career-site',
        },
        when: (input) => runRina(input, undefined, mockAdapter),
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
