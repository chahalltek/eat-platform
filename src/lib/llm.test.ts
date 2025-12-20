import { describe, expect, it, vi } from 'vitest';

import { USER_ROLES } from '@/lib/auth/roles';
import type { OpenAIAdapter } from '@/lib/llm/openaiAdapter';

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

vi.mock('@/lib/llm/tenantControls', () => {
  class LLMUsageRestrictedError extends Error {}

  return {
    assertLlmUsageAllowed: async () => ({
      model: 'gpt-4o-mini',
      verbosityCap: 500,
      maxTokens: 64,
      providerReady: true,
    }),
    LLMUsageRestrictedError,
  };
});

vi.mock('@/lib/rateLimiting/rateLimiter', () => ({
  consumeRateLimit: async () => undefined,
  isRateLimitError: () => false,
  RATE_LIMIT_ACTIONS: { AGENT_RUN: 'AGENT_RUN' },
}));

vi.mock('@/lib/cost/events', () => ({ recordCostEvent: () => undefined }));

// Import after mocks are registered to ensure the gateway wrapper picks up stubs.
import { callLLM } from '@/lib/llm';

describe('callLLM legacy wrapper', () => {
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
});
