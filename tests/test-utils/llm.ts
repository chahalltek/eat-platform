import { vi } from "vitest";

import type { CallLLMParams } from "@/lib/llm";

type LlmResponder = string | ((params: CallLLMParams) => string | Promise<string>);

type CreateMockCallLLMOptions = {
  responses?: LlmResponder | LlmResponder[];
  fallbackResponse?: LlmResponder;
};

const DEFAULT_RESPONSE = "[mock-llm-response]";

export function createMockCallLLM({
  responses = [],
  fallbackResponse = DEFAULT_RESPONSE,
}: CreateMockCallLLMOptions = {}) {
  const queue: LlmResponder[] = Array.isArray(responses) ? [...responses] : [responses];

  const mockCallLLM = vi.fn<(params: CallLLMParams) => Promise<string>>(async (params) => {
    const responder = queue.length > 0 ? queue.shift()! : fallbackResponse;
    const result = typeof responder === "function" ? await responder(params) : responder;

    return result;
  });

  function respondWith(response: LlmResponder) {
    queue.push(response);
  }

  function resetResponses(nextResponses: LlmResponder[] = []) {
    queue.splice(0, queue.length, ...nextResponses);
  }

  return {
    mockCallLLM,
    mockModule: () => ({ callLLM: mockCallLLM }),
    respondWith,
    resetResponses,
  };
}
