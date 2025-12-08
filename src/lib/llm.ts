import OpenAI from 'openai';

import {
  ChatMessage,
  OpenAIAdapter,
  formatEmptyResponseError,
} from '@/lib/llm/openaiAdapter';
import { getCurrentUserId } from '@/lib/auth/user';
import { getCurrentTenantId } from '@/lib/tenant';
import { consumeRateLimit, isRateLimitError, RATE_LIMIT_ACTIONS } from '@/lib/rateLimiting/rateLimiter';
import { AIFailureError } from '@/lib/errors';

type CallLLMParams = {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  adapter?: OpenAIAdapter;
};

class OpenAIChatAdapter implements OpenAIAdapter {
  constructor(private apiKey = process.env.OPENAI_API_KEY) {}

  async chatCompletion({ model, messages, temperature }: { model: string; messages: ChatMessage[]; temperature: number; }): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const response = await new OpenAI({ apiKey: this.apiKey }).chat.completions.create({
      model,
      messages,
      temperature,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw formatEmptyResponseError();
    }

    return content;
  }
}

export async function callLLM({
  systemPrompt,
  userPrompt,
  model = 'gpt-4.1-mini',
  adapter = new OpenAIChatAdapter(),
}: CallLLMParams): Promise<string> {
  const [tenantId, userId] = await Promise.all([getCurrentTenantId(), getCurrentUserId()]);
  await consumeRateLimit({
    tenantId,
    userId,
    action: RATE_LIMIT_ACTIONS.AGENT_RUN,
  });

  try {
    return await adapter.chatCompletion({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    });
  } catch (err) {
    if (isRateLimitError(err)) {
      throw err;
    }

    console.error('Error calling LLM:', err);
    throw new AIFailureError('LLM call failed');
  }
}
