import { describe, expect, it, beforeEach, vi } from 'vitest';

import { AIFailureError } from '@/lib/errors';
import { USER_ROLES } from '@/lib/auth/roles';
import type { OpenAIAdapter } from '@/lib/llm/openaiAdapter';
import { formatEmptyResponseError } from '@/lib/llm/openaiAdapter';
import { LLMSafetyConfigError } from '@/server/ai/safety/config';

vi.mock('@/lib/audit/trail', () => ({ recordAuditEvent: vi.fn() }));

vi.mock('@/lib/auth/user', async () => {
  return {
    getCurrentUser: async () => ({ id: 'user-1' }),
    getUserRoles: async () => [USER_ROLES.ADMIN],
  };
});

vi.mock('@/lib/tenant', () => ({
  getCurrentTenantId: vi.fn().mockResolvedValue('tenant-1'),
}));

const mockAssertLlmUsageAllowed = vi.hoisted(() => vi.fn());

vi.mock('@/lib/llm/tenantControls', () => {
  class LLMUsageRestrictedError extends Error {}

  return {
    assertLlmUsageAllowed: mockAssertLlmUsageAllowed,
    LLMUsageRestrictedError,
  };
});

const mockIsRateLimitError = vi.hoisted(() => vi.fn());
const mockConsumeRateLimit = vi.hoisted(() => vi.fn());
const mockRecordCostEvent = vi.hoisted(() => vi.fn());

vi.mock('@/lib/rateLimiting/rateLimiter', () => ({
  consumeRateLimit: mockConsumeRateLimit,
  isRateLimitError: mockIsRateLimitError,
  RATE_LIMIT_ACTIONS: { AGENT_RUN: 'AGENT_RUN' },
}));

vi.mock('@/lib/cost/events', () => ({ recordCostEvent: mockRecordCostEvent }));

const mockAssertLlmSafetyConfig = vi.hoisted(() => vi.fn());

vi.mock('@/server/ai/safety/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/ai/safety/config')>();
  return {
    ...actual,
    assertLlmSafetyConfig: mockAssertLlmSafetyConfig,
  };
});

// Import after mocks are registered to ensure the gateway wrapper picks up stubs.
import { callLLM } from '@/lib/llm';

describe('callLLM legacy wrapper', () => {
  beforeEach(() => {
    mockAssertLlmUsageAllowed.mockResolvedValue({
      model: 'gpt-4o-mini',
      verbosityCap: 500,
      maxTokens: 64,
      providerReady: true,
      allowedAgents: ['TEST_AGENT'],
    });
    mockAssertLlmSafetyConfig.mockReturnValue({ ok: true });
    mockIsRateLimitError.mockReturnValue(false);
    mockRecordCostEvent.mockReset();
    mockConsumeRateLimit.mockResolvedValue(undefined);
  });

  it('sanitizes outbound context through the AI gateway pipeline', async () => {
    const chatCompletion = vi.fn(async ({ messages }) => {
      const userMessage = messages[1]?.content as string;

      expect(userMessage).toContain('"requestId":"req-123"');
      expect(userMessage).toContain('"tenant":{"name":"Acme Corp","domainTags":["finance","cloud"]}');
      expect(userMessage).not.toContain('secretToken');

      return { content: 'ok' };
    });

    const adapter: OpenAIAdapter = {
      chatCompletion,
    };

    const { getCurrentUser } = await import('@/lib/auth/user');
    await expect(getCurrentUser()).resolves.toEqual({ id: 'user-1' });

    const response = await callLLM({
      agent: 'TEST_AGENT',
      adapter,
      systemPrompt: (context) => `system:${JSON.stringify(context)}`,
      userPrompt: (context) => `user:${JSON.stringify(context)}`,
      context: {
        purpose: 'MATCH',
        metadata: { requestId: 'req-123', secretToken: 'should-be-filtered' } as Record<string, unknown>,
        tenant: {
          name: 'Acme Corp',
          domainTags: ['finance', 'cloud', ''],
          rogueField: 'drop-me',
        } as Record<string, unknown>,
      },
    });

    expect(response).toBe('ok');
    expect(chatCompletion).toHaveBeenCalled();
  });

  it('logs cost metadata from usage', async () => {
    const adapter: OpenAIAdapter = {
      chatCompletion: vi.fn(async () => ({
        text: 'ok',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      })),
    };

    await callLLM({
      agent: 'TEST_AGENT',
      adapter,
      systemPrompt: 'system',
      userPrompt: 'user',
      context: { purpose: 'MATCH', metadata: { requestId: 'cost-test' } },
    });

    expect(mockRecordCostEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        driver: 'LLM_CALL',
        feature: 'TEST_AGENT',
        metadata: expect.objectContaining({
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
          purpose: 'MATCH',
        }),
      }),
    );
  });

  it('rethrows rate limit errors unchanged', async () => {
    const rateLimitError = new Error('Too many requests');
    const adapter: OpenAIAdapter = {
      chatCompletion: vi.fn().mockRejectedValue(rateLimitError),
    };
    mockIsRateLimitError.mockReturnValue(true);

    await expect(
      callLLM({
        agent: 'TEST_AGENT',
        adapter,
        systemPrompt: 'system',
        userPrompt: 'user',
      }),
    ).rejects.toBe(rateLimitError);
  });

  it('wraps empty responses from the adapter', async () => {
    const adapter: OpenAIAdapter = {
      chatCompletion: vi.fn().mockRejectedValue(formatEmptyResponseError()),
    };

    await expect(
      callLLM({
        agent: 'TEST_AGENT',
        adapter,
        systemPrompt: 'system',
        userPrompt: 'user',
      }),
    ).rejects.toBeInstanceOf(AIFailureError);
  });

  it('wraps invalid safety configuration errors', async () => {
    const adapter: OpenAIAdapter = {
      chatCompletion: vi.fn().mockResolvedValue({ text: 'ok' }),
    };
    mockAssertLlmSafetyConfig.mockImplementation(() => {
      throw new LLMSafetyConfigError(['missing redaction']);
    });

    await expect(
      callLLM({
        agent: 'TEST_AGENT',
        adapter,
        systemPrompt: 'system',
        userPrompt: 'user',
      }),
    ).rejects.toMatchObject({ message: 'missing redaction' });
  });
});
