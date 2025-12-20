import { getCurrentUserId } from '@/lib/auth/user';
import { getCurrentTenantId } from '@/lib/tenant';
import { consumeRateLimit, isRateLimitError, RATE_LIMIT_ACTIONS } from '@/lib/rateLimiting/rateLimiter';
import { AIFailureError } from '@/lib/errors';
import { assertLlmUsageAllowed, LLMUsageRestrictedError } from '@/lib/llm/tenantControls';
import { recordCostEvent } from '@/lib/cost/events';
import { logAiCall } from '@/server/audit/logger';
import { OpenAIChatAdapter } from '@/server/ai/openaiClient';
import type { OpenAIAdapter } from '@/lib/llm/openaiAdapter';
import { buildSafeLLMContext, type SafeLLMContext, type SafeLLMContextInput } from '@/server/ai/safety/safeContext';

type CallLLMParams = {
  systemPrompt: string | ((context: SafeLLMContext) => string);
  userPrompt: string | ((context: SafeLLMContext) => string);
  model?: string;
  adapter?: OpenAIAdapter;
  agent: string;
  context?: SafeLLMContextInput | SafeLLMContext;
};

export async function callLLM({
  systemPrompt,
  userPrompt,
  model,
  adapter = new OpenAIChatAdapter(),
  agent,
  context,
}: CallLLMParams): Promise<string> {
  const safeContext = buildSafeLLMContext(context ?? { purpose: 'OTHER' });
  const resolvedSystemPrompt = typeof systemPrompt === 'function' ? systemPrompt(safeContext) : systemPrompt;
  const resolvedUserPrompt = typeof userPrompt === 'function' ? userPrompt(safeContext) : userPrompt;
  const [tenantId, userId] = await Promise.all([getCurrentTenantId(), getCurrentUserId()]);
  const llmControls = await assertLlmUsageAllowed({ tenantId, agent });
  const resolvedModel = model ?? llmControls.model;

  if (resolvedModel !== llmControls.model) {
    throw new LLMUsageRestrictedError('Requested model is not permitted for this tenant.');
  }

  const trimmedUserPrompt = llmControls.verbosityCap
    ? resolvedUserPrompt.slice(0, llmControls.verbosityCap)
    : resolvedUserPrompt;

  await consumeRateLimit({
    tenantId,
    userId,
    action: RATE_LIMIT_ACTIONS.AGENT_RUN,
  });

  try {
    const response = await adapter.chatCompletion({
      model: resolvedModel,
      messages: [
        { role: 'system', content: resolvedSystemPrompt },
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
      systemPromptChars: resolvedSystemPrompt.length,
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
      systemPromptChars: resolvedSystemPrompt.length,
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
