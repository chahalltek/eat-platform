<<<<<<< ours
import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { type ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import { recordAuditEvent } from '@/lib/audit/trail';
import { getCurrentUser, getUserRoles } from '@/lib/auth/user';
import { type UserRole } from '@/lib/auth/roles';
import { AIFailureError } from '@/lib/errors';
import {
  ChatMessage,
  OpenAIAdapter,
  formatEmptyResponseError,
  type ChatCompletionResult,
  type ChatCompletionUsage,
} from '@/lib/llm/openaiAdapter';
import { assertLlmUsageAllowed, LLMUsageRestrictedError } from '@/lib/llm/tenantControls';
import { recordCostEvent } from '@/lib/cost/events';
import { consumeRateLimit, isRateLimitError, RATE_LIMIT_ACTIONS } from '@/lib/rateLimiting/rateLimiter';
<<<<<<< ours
=======
import { enforceLimits as enforceContextLimits } from '@/server/ai/safety/limits';
import type { SafeLLMContext as LimitedSafeLLMContext } from '@/server/ai/safety/limits';
>>>>>>> theirs
import { getCurrentTenantId } from '@/lib/tenant';
import { redactAny } from '@/server/ai/safety/redact';
import { buildSafeLLMContext, type SafeLLMContext, type SafeLLMContextInput } from '@/server/ai/safety/safeContext';

export type GatewayCapability = 'read' | 'write';
=======
import { randomUUID } from "crypto";

import OpenAI from "openai";

import { recordAuditEvent } from "@/lib/audit/trail";
import { type UserRole } from "@/lib/auth/roles";
import { getCurrentUser, getUserRoles } from "@/lib/auth/user";
import { recordCostEvent } from "@/lib/cost/events";
import { AIFailureError } from "@/lib/errors";
import type { OpenAIAdapter } from "@/lib/llm/openaiAdapter";
import { assertLlmUsageAllowed, LLMUsageRestrictedError } from "@/lib/llm/tenantControls";
import { consumeRateLimit, isRateLimitError, RATE_LIMIT_ACTIONS } from "@/lib/rateLimiting/rateLimiter";
import { getCurrentTenantId } from "@/lib/tenant";
import { OpenAIChatAdapter } from "@/server/ai/openaiClient";
import { assertLlmSafetyConfig, LLMSafetyConfigError } from "@/server/ai/safety/config";
import { enforceLimits as enforceContextLimits, type SafeLLMContext as LimitedSafeLLMContext } from "@/server/ai/safety/limits";
import { redactAny } from "@/server/ai/safety/redact";
import { buildSafeLLMContext, type SafeLLMContext, type SafeLLMContextInput } from "@/server/ai/safety/safeContext";

export type GatewayCapability = "read" | "write";
>>>>>>> theirs

export type CallLLMParams = {
  systemPrompt: string | ((context: SafeLLMContext) => string);
  userPrompt: string | ((context: SafeLLMContext) => string);
  model?: string;
  adapter?: OpenAIAdapter;
  agent: string;
  capability?: GatewayCapability;
  approvalToken?: string;
  redactResult?: boolean;
  context?: SafeLLMContextInput | SafeLLMContext;
<<<<<<< ours
<<<<<<< ours
};

type LlmLogLevel = 'metadata' | 'redacted' | 'off';

type LlmLogConfig = {
  level: LlmLogLevel;
  promptLoggingEnabled: boolean;
  promptTtlMs: number;
=======
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
  }): Promise<ChatCompletionResult> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const response = await new OpenAI({ apiKey: this.apiKey }).chat.completions.create({
      model,
      messages: messages as ChatCompletionMessageParam[],
      temperature,
      max_tokens: maxTokens,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw formatEmptyResponseError();
    }

    const usage = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens ?? null,
          completionTokens: response.usage.completion_tokens ?? null,
          totalTokens: response.usage.total_tokens ?? null,
        }
      : undefined;

    return { content, usage };
  }
}

const EXECUTION_ENABLED = process.env.EXECUTION_ENABLED === 'true';
const DEFAULT_LOG_TTL_HOURS = 24;
=======
};

const EXECUTION_ENABLED = process.env.EXECUTION_ENABLED === "true";
>>>>>>> theirs

function redactSnippet(value?: string | null) {
  if (!value) return null;
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

function resolveLoggingConfig(env: NodeJS.ProcessEnv = process.env): LlmLogConfig {
  const allowedLevels: LlmLogLevel[] = ['metadata', 'redacted', 'off'];
  const envLevel = env.LLM_LOG_LEVEL as LlmLogLevel | undefined;
  const level: LlmLogLevel = allowedLevels.includes(envLevel ?? 'metadata') ? envLevel ?? 'metadata' : 'metadata';
  const promptLoggingEnabled = env.LLM_LOG_PROMPTS === 'true';
  const ttlHours = Number(env.LLM_LOG_TTL_HOURS ?? DEFAULT_LOG_TTL_HOURS);
  const promptTtlMs = Number.isFinite(ttlHours) && ttlHours > 0
    ? ttlHours * 60 * 60 * 1000
    : DEFAULT_LOG_TTL_HOURS * 60 * 60 * 1000;

  return { level, promptLoggingEnabled, promptTtlMs };
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
  const resolvedContext = contextInput ?? { purpose: "OTHER" };
  const metadata = (resolvedContext as { metadata?: SafeLLMContext["metadata"] }).metadata ?? {};
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

<<<<<<< ours
function enforceVerbosityCap<T>(value: T, verbosityCap?: number): T {
=======
function applyVerbosityLimits<T>(value: T, verbosityCap?: number): T {
>>>>>>> theirs
  if (!verbosityCap) return value;

  const clamp = (entry: unknown): unknown => {
    if (typeof entry === "string") {
      return entry.length > verbosityCap ? entry.slice(0, verbosityCap) : entry;
    }

    if (Array.isArray(entry)) {
      return entry.map(clamp);
    }

    if (entry && typeof entry === "object") {
      if (entry instanceof Date || entry instanceof RegExp) return entry;

      return Object.fromEntries(
        Object.entries(entry as Record<string, unknown>).map(([key, val]) => [key, clamp(val)]),
      );
    }

    return entry;
  };

  return clamp(value) as T;
}

function sanitizePrompt(value: string): string {
  const redacted = redactAny(value);
  return typeof redacted === "string" ? redacted : JSON.stringify(redacted);
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
<<<<<<< ours
<<<<<<< ours
  const limitedContext = enforceVerbosityCap(redactedContext, verbosityCap);
=======
  const limitedContext = enforceVerbosityCap(
    enforceContextLimits(redactedContext as LimitedSafeLLMContext),
    verbosityCap,
  ) as SafeLLMContext;
>>>>>>> theirs
=======

  const limitedContext = applyVerbosityLimits(
    enforceContextLimits(redactedContext as unknown as LimitedSafeLLMContext) as unknown as SafeLLMContext,
    verbosityCap,
  );

  const resolvedSystemPrompt = typeof systemPrompt === "function" ? systemPrompt(limitedContext) : systemPrompt;
  const resolvedUserPrompt = typeof userPrompt === "function" ? userPrompt(limitedContext) : userPrompt;
>>>>>>> theirs

  return {
    context: limitedContext,
    systemPrompt: sanitizePrompt(resolvedSystemPrompt),
    userPrompt: sanitizePrompt(resolvedUserPrompt),
  };
}

async function resolveCaller() {
  const [user, roles, tenantId] = await Promise.all([getCurrentUser(), getUserRoles(), getCurrentTenantId()]);

  if (!user) {
    throw new Error("AI gateway requires an authenticated user");
  }

  if (!roles.length) {
    throw new Error("AI gateway requires a user role");
  }

  return { userId: user.id, roles, tenantId };
}

function assertWriteCapabilityAllowed(capability: GatewayCapability, approvalToken?: string) {
  if (capability !== "write") return;

  if (!EXECUTION_ENABLED) {
    throw new Error("EXECUTION_ENABLED must be true to allow write capabilities");
  }

  if (!approvalToken) {
    throw new Error("An approval token is required for write capabilities");
  }
}

function toRedactedLogValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const scrubbed = redactAny(value);
  const asString = typeof scrubbed === 'string' ? scrubbed : JSON.stringify(scrubbed);
  return redactSnippet(asString);
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
  logConfig,
  usage,
  latencyMs,
  purpose,
  rawSystemPrompt,
  rawUserPrompt,
}: {
  userId: string;
  tenantId: string;
  agent: string;
  capability: GatewayCapability;
  model: string;
  approvalToken?: string;
  status: "success" | "failure";
  systemPrompt: string;
  userPrompt: string;
  roles: UserRole[];
  result: string | null;
  redactResult: boolean;
  logConfig: LlmLogConfig;
  usage?: ChatCompletionUsage | null;
  latencyMs?: number;
  purpose?: SafeLLMContext['purpose'];
  rawSystemPrompt?: string;
  rawUserPrompt?: string;
}) {
  const shouldLogPrompts = logConfig.promptLoggingEnabled && logConfig.level === 'redacted';
  const redactedResult = redactResult ? toRedactedLogValue(result) : null;
  const systemForLog = rawSystemPrompt ?? systemPrompt;
  const userForLog = rawUserPrompt ?? userPrompt;

  try {
    await recordAuditEvent({
      userId,
      action: "AI_GATEWAY_CALL",
      resource: "ai",
      resourceId: agent,
      metadata: {
        tenantId,
        capability,
        model,
        approvalTokenProvided: Boolean(approvalToken),
        status,
        role: roles[0] ?? null,
        promptLogLevel: logConfig.level,
        promptLoggingEnabled: shouldLogPrompts,
        promptLengths: {
          system: systemPrompt.length,
          user: userPrompt.length,
          result: result?.length ?? null,
        },
        prompts: shouldLogPrompts
          ? {
              system: toRedactedLogValue(systemForLog),
              user: toRedactedLogValue(userForLog),
              result: redactedResult,
              promptExpiresAt: new Date(Date.now() + logConfig.promptTtlMs).toISOString(),
              promptTtlMs: logConfig.promptTtlMs,
            }
          : undefined,
        usage: usage
          ? {
              promptTokens: usage.promptTokens ?? null,
              completionTokens: usage.completionTokens ?? null,
              totalTokens: usage.totalTokens ?? null,
            }
          : undefined,
        latencyMs: latencyMs ?? null,
        purpose: purpose ?? null,
      },
    });
  } catch (error) {
    console.error("[ai-gateway] Failed to record audit event", redactAny(error));
  }
}

export async function callLLM({
  systemPrompt,
  userPrompt,
  model,
  adapter = new OpenAIChatAdapter(),
  agent,
  capability = "read",
  approvalToken,
  redactResult = true,
  context,
}: CallLLMParams): Promise<string> {
  const caller = await resolveCaller();
  const logConfig = resolveLoggingConfig();
  const startedAt = Date.now();
  let response: string | null = null;
<<<<<<< ours
  let status: 'success' | 'failure' = 'success';
  let resolvedModel = model ?? 'unknown';
<<<<<<< ours
  let resolvedSystemPrompt = '';
  let resolvedUserPrompt = '';
  let sanitized: SanitizedOutbound | null = null;
  let usage: ChatCompletionUsage | null = null;
=======
  let resolvedSystemPrompt = typeof systemPrompt === 'string' ? systemPrompt : '';
  let trimmedUserPrompt = typeof userPrompt === 'string' ? userPrompt : '';
>>>>>>> theirs
=======
  let status: "success" | "failure" = "success";
  let resolvedModel = model ?? "unknown";
  let resolvedSystemPrompt = "";
  let trimmedUserPrompt = "";
>>>>>>> theirs

  try {
    assertWriteCapabilityAllowed(capability, approvalToken);
    assertLlmSafetyConfig();

    const llmControls = await assertLlmUsageAllowed({ tenantId: caller.tenantId, agent });
    resolvedModel = model ?? llmControls.model;

    if (resolvedModel !== llmControls.model) {
      throw new LLMUsageRestrictedError("Requested model is not permitted for this tenant.");
    }

<<<<<<< ours
<<<<<<< ours
    sanitized = sanitizeOutbound({
=======
=======
>>>>>>> theirs
    const sanitized = sanitizeOutbound({
>>>>>>> theirs
      contextInput: context,
      systemPrompt,
      userPrompt,
      verbosityCap: llmControls.verbosityCap,
    });

    resolvedSystemPrompt = sanitized.systemPrompt;
<<<<<<< ours
    resolvedUserPrompt = llmControls.verbosityCap
      ? sanitized.userPrompt.slice(0, llmControls.verbosityCap)
      : sanitized.userPrompt;
<<<<<<< ours
=======

    const resolvedUserPrompt = buildUserPrompt
      ? buildUserPrompt(sanitized.context)
      : sanitized.userPrompt;

    trimmedUserPrompt = llmControls.verbosityCap
      ? resolvedUserPrompt.slice(0, llmControls.verbosityCap)
      : resolvedUserPrompt;
>>>>>>> theirs
=======
>>>>>>> theirs

    await consumeRateLimit({
      tenantId: caller.tenantId,
      userId: caller.userId,
      action: RATE_LIMIT_ACTIONS.AGENT_RUN,
    });

    const llmResult = await adapter.chatCompletion({
      model: resolvedModel,
      messages: [
<<<<<<< ours
        { role: 'system', content: resolvedSystemPrompt },
        { role: 'user', content: resolvedUserPrompt },
=======
        { role: "system", content: resolvedSystemPrompt },
        { role: "user", content: trimmedUserPrompt },
>>>>>>> theirs
      ],
      temperature: 0.2,
      maxTokens: llmControls.maxTokens,
    });

    response = llmResult.content;
    usage = llmResult.usage ?? null;

    const latencyMs = Date.now() - startedAt;

    void recordCostEvent({
      tenantId: caller.tenantId,
      driver: "LLM_CALL",
      value: 1,
      unit: "call",
      sku: resolvedModel,
      feature: agent,
      metadata: {
        userId: caller.userId,
        model: resolvedModel,
        promptTokens: usage?.promptTokens ?? null,
        completionTokens: usage?.completionTokens ?? null,
        totalTokens: usage?.totalTokens ?? null,
        latencyMs,
        purpose: sanitized?.context.purpose ?? null,
      },
    });

    return response;
  } catch (err) {
    status = "failure";

    if (isRateLimitError(err)) {
      throw err;
    }

    if (err instanceof LLMUsageRestrictedError) {
      throw err;
    }

    if (err instanceof LLMSafetyConfigError) {
      console.error("[ai-gateway] LLM safety check failed", redactAny(err));
      throw new AIFailureError(err.message);
    }

    console.error("Error calling LLM:", redactAny(err));
    throw new AIFailureError("LLM call failed");
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
      userPrompt: resolvedUserPrompt,
      result: response,
      redactResult,
      logConfig,
      usage,
      latencyMs: Date.now() - startedAt,
      purpose: sanitized?.context.purpose,
      rawSystemPrompt: sanitized?.systemPrompt,
      rawUserPrompt: sanitized?.userPrompt,
    });
  }
}

export async function verifyLLMProvider(model = "gpt-4o-mini") {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const client = new OpenAI({ apiKey });
  await client.models.retrieve(model);
}
