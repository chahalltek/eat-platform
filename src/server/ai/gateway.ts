import { randomUUID } from 'crypto';
import OpenAI from 'openai';

import { recordAuditEvent } from '@/lib/audit/trail';
import { getCurrentUser, getUserRoles } from '@/lib/auth/user';
import { type UserRole } from '@/lib/auth/roles';
import { AIFailureError } from '@/lib/errors';
import { ChatMessage, OpenAIAdapter, formatEmptyResponseError } from '@/lib/llm/openaiAdapter';
import { assertLlmUsageAllowed, LLMUsageRestrictedError } from '@/lib/llm/tenantControls';
import { recordCostEvent } from '@/lib/cost/events';
import { consumeRateLimit, isRateLimitError, RATE_LIMIT_ACTIONS } from '@/lib/rateLimiting/rateLimiter';
import { enforceLimits, type SafeLLMContext } from '@/server/ai/safety/limits';
import { getCurrentTenantId } from '@/lib/tenant';
import { redactAny } from '@/server/ai/safety/redact';
import { buildSafeLLMContext, type SafeLLMContext, type SafeLLMContextInput } from '@/server/ai/safety/safeContext';

export type GatewayCapability = 'read' | 'write';

export type CallLLMParams = {
  systemPrompt: string | ((context: SafeLLMContext) => string);
  userPrompt: string | ((context: SafeLLMContext) => string);
  model?: string;
  adapter?: OpenAIAdapter;
  agent: string;
  capability?: GatewayCapability;
  approvalToken?: string;
  redactResult?: boolean;
<<<<<<< ours
  context?: SafeLLMContextInput | SafeLLMContext;
=======
  context?: SafeLLMContext;
  buildUserPrompt?: (context: SafeLLMContext) => string;
>>>>>>> theirs
};

class OpenAIChatAdapter implements OpenAIAdapter {
  constructor(private apiKey = process.env.OPENAI_API_KEY) {}

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

const EXECUTION_ENABLED = process.env.EXECUTION_ENABLED === 'true';

function redactSnippet(value?: string | null) {
  if (!value) return null;
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

type SanitizeOutboundParams = {
  contextInput?: SafeLLMContextInput | SafeLLMContext;
  systemPrompt: string | ((context: SafeLLMContext) => string);
  userPrompt: string | ((context: SafeLLMContext) => string);
  verbosityCap?: number;
};

type SanitizedOutbound = {
  context: SafeLLMContext;
  systemPrompt: string;
  userPrompt: string;
};

function ensureRequestIdentifiers(
  contextInput: SafeLLMContextInput | SafeLLMContext | undefined,
): SafeLLMContextInput {
  const resolvedContext = contextInput ?? { purpose: 'OTHER' };
  const metadata = (resolvedContext as { metadata?: SafeLLMContext['metadata'] }).metadata ?? {};
  const requestId = metadata.requestId ?? randomUUID();
  const correlationId = metadata.correlationId ?? requestId;

  return {
    ...resolvedContext,
    metadata: {
      ...metadata,
      requestId,
      correlationId,
    },
  } satisfies SafeLLMContextInput;
}

function enforceLimits<T>(value: T, { verbosityCap }: { verbosityCap?: number } = {}): T {
  if (!verbosityCap) return value;

  const clamp = (entry: unknown): unknown => {
    if (typeof entry === 'string') {
      return entry.length > verbosityCap ? entry.slice(0, verbosityCap) : entry;
    }

    if (Array.isArray(entry)) {
      return entry.map(clamp);
    }

    if (entry && typeof entry === 'object') {
      if (entry instanceof Date || entry instanceof RegExp) return entry;

      return Object.fromEntries(
        Object.entries(entry as Record<string, unknown>).map(([key, val]) => [key, clamp(val)]),
      );
    }

    return entry;
  };

  return clamp(value) as T;
}

export function sanitizeOutbound({
  contextInput,
  systemPrompt,
  userPrompt,
  verbosityCap,
}: SanitizeOutboundParams): SanitizedOutbound {
  const contextWithIds = ensureRequestIdentifiers(contextInput);
  const safeContext = buildSafeLLMContext(contextWithIds);
  const redactedContext = redactAny(safeContext) as SafeLLMContext;
  const limitedContext = enforceLimits(redactedContext, { verbosityCap });

  return {
    context: limitedContext,
    systemPrompt: typeof systemPrompt === 'function' ? systemPrompt(limitedContext) : systemPrompt,
    userPrompt: typeof userPrompt === 'function' ? userPrompt(limitedContext) : userPrompt,
  };
}

async function resolveCaller() {
  const [user, roles, tenantId] = await Promise.all([
    getCurrentUser(),
    getUserRoles(),
    getCurrentTenantId(),
  ]);

  if (!user) {
    throw new Error('AI gateway requires an authenticated user');
  }

  if (!roles.length) {
    throw new Error('AI gateway requires a user role');
  }

  return { userId: user.id, roles, tenantId };
}

function assertWriteCapabilityAllowed(capability: GatewayCapability, approvalToken?: string) {
  if (capability !== 'write') return;

  if (!EXECUTION_ENABLED) {
    throw new Error('EXECUTION_ENABLED must be true to allow write capabilities');
  }

  if (!approvalToken) {
    throw new Error('An approval token is required for write capabilities');
  }
}

async function recordAIAuditEvent({
  userId,
  tenantId,
  agent,
  capability,
  model,
  approvalToken,
  status,
  systemPrompt,
  userPrompt,
  roles,
  result,
  redactResult,
}: {
  userId: string;
  tenantId: string;
  agent: string;
  capability: GatewayCapability;
  model: string;
  approvalToken?: string;
  status: 'success' | 'failure';
  systemPrompt: string;
  userPrompt: string;
  roles: UserRole[];
  result: string | null;
  redactResult: boolean;
}) {
  try {
    await recordAuditEvent({
      userId,
      action: 'AI_GATEWAY_CALL',
      resource: 'ai',
      resourceId: agent,
      metadata: {
        tenantId,
        capability,
        model,
        approvalTokenProvided: Boolean(approvalToken),
        status,
        role: roles[0] ?? null,
        prompts: {
          system: redactSnippet(systemPrompt),
          user: redactSnippet(userPrompt),
        },
        resultPreview: result ? (redactResult ? redactSnippet(result) : result) : null,
      },
    });
  } catch (error) {
    console.error('[ai-gateway] Failed to record audit event', redactAny(error));
  }
}

export async function callLLM({
  systemPrompt,
  userPrompt,
  model,
  adapter = new OpenAIChatAdapter(),
  agent,
  capability = 'read',
  approvalToken,
  redactResult = true,
  context,
<<<<<<< ours
=======
  buildUserPrompt,
>>>>>>> theirs
}: CallLLMParams): Promise<string> {
  const contextWithIds = ensureRequestIdentifiers(context);
  const caller = await resolveCaller();
  let response: string | null = null;
  let status: 'success' | 'failure' = 'success';
  let resolvedModel = model ?? 'unknown';
<<<<<<< ours
<<<<<<< ours
  let trimmedUserPrompt = resolvedUserPrompt;
=======
  let trimmedUserPrompt = userPrompt;
  const safeContext = context ? enforceLimits(context) : undefined;
>>>>>>> theirs
=======
  let resolvedSystemPrompt = '';
  let trimmedUserPrompt = '';
>>>>>>> theirs

  try {
    assertWriteCapabilityAllowed(capability, approvalToken);

    const llmControls = await assertLlmUsageAllowed({ tenantId: caller.tenantId, agent });
    resolvedModel = model ?? llmControls.model;

    if (resolvedModel !== llmControls.model) {
      throw new LLMUsageRestrictedError('Requested model is not permitted for this tenant.');
    }

<<<<<<< ours
<<<<<<< ours
    trimmedUserPrompt = llmControls.verbosityCap
      ? resolvedUserPrompt.slice(0, llmControls.verbosityCap)
      : resolvedUserPrompt;
=======
    const rawUserPrompt = safeContext && buildUserPrompt
      ? buildUserPrompt(safeContext)
      : userPrompt;
>>>>>>> theirs

    trimmedUserPrompt = llmControls.verbosityCap
      ? rawUserPrompt.slice(0, llmControls.verbosityCap)
      : rawUserPrompt;
=======
    const sanitized = sanitizeOutbound({
      contextInput: contextWithIds,
      systemPrompt,
      userPrompt,
      verbosityCap: llmControls.verbosityCap,
    });

    resolvedSystemPrompt = sanitized.systemPrompt;
    trimmedUserPrompt = llmControls.verbosityCap
      ? sanitized.userPrompt.slice(0, llmControls.verbosityCap)
      : sanitized.userPrompt;
>>>>>>> theirs

    await consumeRateLimit({
      tenantId: caller.tenantId,
      userId: caller.userId,
      action: RATE_LIMIT_ACTIONS.AGENT_RUN,
    });

    response = await adapter.chatCompletion({
      model: resolvedModel,
      messages: [
        { role: 'system', content: resolvedSystemPrompt },
        { role: 'user', content: trimmedUserPrompt },
      ],
      temperature: 0.2,
      maxTokens: llmControls.maxTokens,
    });

    void recordCostEvent({
      tenantId: caller.tenantId,
      driver: 'LLM_CALL',
      value: 1,
      unit: 'call',
      sku: resolvedModel,
      feature: agent,
      metadata: { userId: caller.userId },
    });

    return response;
  } catch (err) {
    status = 'failure';

    if (isRateLimitError(err)) {
      throw err;
    }

    if (err instanceof LLMUsageRestrictedError) {
      throw err;
    }

    console.error('Error calling LLM:', redactAny(err));
    throw new AIFailureError('LLM call failed');
  } finally {
    await recordAIAuditEvent({
      userId: caller.userId,
      tenantId: caller.tenantId,
      agent,
      capability,
      model: resolvedModel,
      approvalToken,
      status,
      roles: caller.roles,
      systemPrompt: resolvedSystemPrompt,
      userPrompt: trimmedUserPrompt,
      result: response,
      redactResult,
    });
  }
}

export async function verifyLLMProvider(model = 'gpt-4o-mini') {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const client = new OpenAI({ apiKey });
  await client.models.retrieve(model);
}
