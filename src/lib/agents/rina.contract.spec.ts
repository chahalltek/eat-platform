/// <reference types="vitest/globals" />

import { runRina } from '@/lib/agents/rina';
import { RINA_PROMPT_VERSION, RINA_SYSTEM_PROMPT } from '@/lib/agents/contracts/rinaContract';
import { MockOpenAIAdapter } from '@/lib/llm/mockOpenAIAdapter';
import { prisma } from '@/server/db/prisma';
import { resetIdentityProvider, setIdentityProvider } from '@/lib/auth/identityProvider';
import { USER_ROLES } from '@/lib/auth/roles';

const { mockAssertLlmUsageAllowed } = vi.hoisted(() => ({
  mockAssertLlmUsageAllowed: vi.fn(async () => ({
    provider: 'openai',
    model: 'gpt-4o-mini',
    verbosityCap: null,
    maxTokens: undefined,
    allowedAgents: ['RINA'],
    providerReady: true,
  })),
}));

vi.mock('@/lib/llm/tenantControls', () => {
  class MockLLMUsageRestrictedError extends Error {}

  return {
    assertLlmUsageAllowed: mockAssertLlmUsageAllowed,
    LLMUsageRestrictedError: MockLLMUsageRestrictedError,
  };
});

vi.mock('@/server/db/prisma', () => ({
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
  isTableAvailable: vi.fn(async () => true),
}));

vi.mock('@/lib/agents/agentRun', () => ({
  withAgentRun: vi.fn(async (_meta, handler) => {
    const outcome = await handler();
    return [outcome.result, 'agent-run-ct'];
  }),
}));

describe('RINA contract enforcement', () => {
  const mockAdapter = new MockOpenAIAdapter();
  const testIdentityProvider = {
    async getCurrentUser() {
      return {
        id: 'test-user',
        email: 'test@example.com',
        displayName: 'Test User',
        role: USER_ROLES.ADMIN,
        permissions: [],
        tenantId: 'test-tenant',
      };
    },
    async getUserRoles() {
      return [USER_ROLES.ADMIN];
    },
    async getUserTenantId() {
      return 'test-tenant';
    },
    async getUserClaims() {
      return {
        userId: 'test-user',
        tenantId: 'test-tenant',
        roles: [USER_ROLES.ADMIN],
        permissions: [],
        email: 'test@example.com',
        displayName: 'Test User',
      };
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter.reset();
    setIdentityProvider(testIdentityProvider);
  });

  afterEach(() => {
    resetIdentityProvider();
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
