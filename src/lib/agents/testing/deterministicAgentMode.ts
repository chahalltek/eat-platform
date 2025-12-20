import { vi } from 'vitest';

import type { OpenAIAdapter } from '@/lib/llm/openaiAdapter';

type DeterministicAgentModeOptions = {
  /**
   * Map of agent name to deterministic LLM response fixtures.
   */
  llmFixtures?: Record<string, string>;
};

type CallLLMParams = {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  adapter?: OpenAIAdapter;
  agent: string;
};

type DeterministicAgentMode = {
  restore: () => void;
  llmMock: ReturnType<typeof vi.fn<(params: CallLLMParams) => Promise<string>>>;
};

export function enableDeterministicAgentMode(
  options: DeterministicAgentModeOptions = {},
): DeterministicAgentMode {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

  const mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
  const uuidSpy =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000')
      : null;

  const llmMock = vi.fn(async ({ agent, adapter, systemPrompt, userPrompt }: CallLLMParams) => {
    if (adapter) {
      const result = await adapter.chatCompletion({
        model: 'deterministic-mock-model',
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      return result.content;
    }

    const fixture = options.llmFixtures?.[agent];
    if (!fixture) {
      throw new Error(`No deterministic LLM fixture configured for agent ${agent}`);
    }

    return fixture;
  });

  return {
    llmMock,
    restore: () => {
      mathRandomSpy.mockRestore();
      uuidSpy?.mockRestore();
      vi.useRealTimers();
    },
  };
}
