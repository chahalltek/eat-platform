<<<<<<< ours
<<<<<<< ours
export { callLLM, type CallLLMParams, type GatewayCapability } from '@/server/ai/gateway';
=======
import OpenAI from 'openai';

import { ChatMessage, OpenAIAdapter, formatEmptyResponseError } from '@/lib/llm/openaiAdapter';
=======
import { ChatMessage, OpenAIAdapter } from '@/lib/llm/openaiAdapter';
>>>>>>> theirs
import { getCurrentUserId } from '@/lib/auth/user';
import { getCurrentTenantId } from '@/lib/tenant';
import { consumeRateLimit, isRateLimitError, RATE_LIMIT_ACTIONS } from '@/lib/rateLimiting/rateLimiter';
import { AIFailureError } from '@/lib/errors';
import { assertLlmUsageAllowed, LLMUsageRestrictedError } from '@/lib/llm/tenantControls';
import { recordCostEvent } from '@/lib/cost/events';
<<<<<<< ours
<<<<<<< ours
import { getOpenAIApiKey } from '@/server/config/secrets';
=======
import { logAiCall } from '@/server/audit/logger';
>>>>>>> theirs
=======
import { OpenAIChatAdapter } from '@/server/ai/openaiClient';
>>>>>>> theirs

type CallLLMParams = {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  adapter?: OpenAIAdapter;
  agent: string;
};

<<<<<<< ours
class OpenAIChatAdapter implements OpenAIAdapter {
  constructor(private apiKey = getOpenAIApiKey()) {}

  async chatCompletion({ model, messages, temperature, maxTokens }: {
    model: string;
    messages: ChatMessage[];
    temperature: number;
    maxTokens?: number;
  }): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const response = await new OpenAI({ apiKey: this.apiKey }).chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw formatEmptyResponseError();
    }

    return content;
  }
}

=======
>>>>>>> theirs
export async function callLLM({
  systemPrompt,
  userPrompt,
  model,
  adapter = new OpenAIChatAdapter(),
  agent,
}: CallLLMParams): Promise<string> {
  const [tenantId, userId] = await Promise.all([getCurrentTenantId(), getCurrentUserId()]);
  const llmControls = await assertLlmUsageAllowed({ tenantId, agent });
  const resolvedModel = model ?? llmControls.model;

  if (resolvedModel !== llmControls.model) {
    throw new LLMUsageRestrictedError('Requested model is not permitted for this tenant.');
  }

  const trimmedUserPrompt = llmControls.verbosityCap
    ? userPrompt.slice(0, llmControls.verbosityCap)
    : userPrompt;

  await consumeRateLimit({
    tenantId,
    userId,
    action: RATE_LIMIT_ACTIONS.AGENT_RUN,
  });

  try {
    const response = await adapter.chatCompletion({
      model: resolvedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: trimmedUserPrompt },
      ],
      temperature: 0.2,
      maxTokens: llmControls.maxTokens,
    });

    void recordCostEvent({
      tenantId,
      driver: 'LLM_CALL',
      value: 1,
      unit: 'call',
      sku: resolvedModel,
      feature: agent,
      metadata: { userId },
    });

    logAiCall({
      tenantId,
      actorId: userId,
      agent,
      model: resolvedModel,
      systemPromptChars: systemPrompt.length,
      userPromptChars: trimmedUserPrompt.length,
      status: 'SUCCESS',
    });

    return response;
  } catch (err) {
    logAiCall({
      tenantId,
      actorId: userId,
      agent,
      model: resolvedModel,
      systemPromptChars: systemPrompt.length,
      userPromptChars: trimmedUserPrompt.length,
      status: 'FAILED',
      error: err instanceof Error ? err.message : 'Unknown error',
    });

    if (isRateLimitError(err)) {
      throw err;
    }

    if (err instanceof LLMUsageRestrictedError) {
      throw err;
    }

    console.error('Error calling LLM:', err);
    throw new AIFailureError('LLM call failed');
  }
}
>>>>>>> theirs
