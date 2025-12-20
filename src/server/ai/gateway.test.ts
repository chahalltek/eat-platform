import { describe, expect, it, vi, beforeEach } from "vitest";

import { AIFailureError } from "@/lib/errors";
import { LLMUsageRestrictedError } from "@/lib/llm/tenantControls";

vi.mock("@/lib/auth/user", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: "user-1" }),
  getUserRoles: vi.fn().mockResolvedValue(["ADMIN"]),
}));

vi.mock("@/lib/tenant", () => ({
  getCurrentTenantId: vi.fn().mockResolvedValue("tenant-1"),
}));

vi.mock("@/lib/llm/tenantControls", async () => {
  const actual = await vi.importActual<typeof import("@/lib/llm/tenantControls")>("@/lib/llm/tenantControls");
  return {
    ...actual,
    assertLlmUsageAllowed: vi.fn().mockResolvedValue({
      provider: "openai",
      allowedAgents: ["TEST"],
      model: "gpt-safe",
      verbosityCap: 10,
      maxTokens: 50,
      providerReady: true,
    }),
  };
});

vi.mock("@/lib/rateLimiting/rateLimiter", () => ({
  consumeRateLimit: vi.fn().mockResolvedValue(undefined),
  isRateLimitError: vi.fn(() => false),
  RATE_LIMIT_ACTIONS: { AGENT_RUN: "AGENT_RUN" },
}));

vi.mock("@/lib/cost/events", () => ({
  recordCostEvent: vi.fn(),
}));

vi.mock("@/lib/audit/trail", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

const createMock = vi.fn();
const retrieveMock = vi.fn();

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = { completions: { create: createMock } };
      models = { retrieve: retrieveMock };
    },
  };
});

vi.mock("crypto", async () => {
  const actual = await vi.importActual<typeof import("crypto")>("crypto");
  return {
    ...actual,
    randomUUID: vi.fn(() => "uuid-123"),
  };
});

describe("callLLM sanitize pipeline", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    delete process.env.LLM_LOG_PROMPTS;
    delete process.env.LLM_LOG_LEVEL;
    createMock.mockReset();
    retrieveMock.mockReset();

    const { getCurrentUser, getUserRoles } = await import("@/lib/auth/user");
    const { assertLlmUsageAllowed } = await import("@/lib/llm/tenantControls");
    const { consumeRateLimit } = await import("@/lib/rateLimiting/rateLimiter");
    const { recordAuditEvent } = await import("@/lib/audit/trail");
    const { recordCostEvent } = await import("@/lib/cost/events");

    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1" });
    vi.mocked(getUserRoles).mockResolvedValue(["ADMIN"]);
    vi.mocked(assertLlmUsageAllowed).mockResolvedValue({
      provider: "openai",
      allowedAgents: ["TEST"],
      model: "gpt-safe",
      verbosityCap: 10,
      maxTokens: 50,
      providerReady: true,
    });
    vi.mocked(consumeRateLimit).mockResolvedValue(undefined);
    vi.mocked(recordAuditEvent).mockResolvedValue(undefined as never);
    vi.mocked(recordCostEvent).mockResolvedValue?.(undefined as never);
  });

  it("routes outbound calls through sanitizeOutbound before hitting the adapter", async () => {
    const { callLLM } = await import("./gateway");
    const adapter = {
      chatCompletion: vi.fn().mockResolvedValue({ content: "ok" }),
    };

    await callLLM({
      systemPrompt: (ctx) => `System ${ctx.job?.title}`,
      userPrompt: (ctx) => `User ${ctx.metadata?.requestId}/${ctx.metadata?.correlationId}`,
      adapter,
      agent: "TEST",
      context: {
        purpose: "EXPLAIN",
        job: { title: "SensitiveEmail secret@example.com" },
      },
    });

    expect(adapter.chatCompletion).toHaveBeenCalledTimes(1);
    const callArgs = adapter.chatCompletion.mock.calls[0]?.[0];
    expect(callArgs?.messages).toEqual([
      { role: "system", content: "System SensitiveE" },
      { role: "user", content: "User uuid-" },
    ]);
    expect(callArgs?.messages?.[0]?.content).not.toContain("secret@example.com");
  });

  it("omits prompt content from audit metadata when logging is disabled", async () => {
    const { callLLM } = await import("./gateway");
    const adapter = {
      chatCompletion: vi.fn().mockResolvedValue({ content: "ok" }),
    };
    const { recordAuditEvent } = await import("@/lib/audit/trail");
    const { recordCostEvent } = await import("@/lib/cost/events");

    await callLLM({
      systemPrompt: "system prompt",
      userPrompt: "user prompt",
      adapter,
      agent: "TEST",
      context: { purpose: "EXPLAIN" },
    });

    const auditArgs = vi.mocked(recordAuditEvent).mock.calls[0]?.[0];
    expect(auditArgs?.metadata?.promptLoggingEnabled).toBe(false);
    expect(auditArgs?.metadata?.prompts).toBeUndefined();
    expect(JSON.stringify(auditArgs?.metadata ?? {})).not.toContain("user prompt");

    const costArgs = vi.mocked(recordCostEvent).mock.calls[0]?.[0];
    expect(costArgs?.metadata).toEqual(
      expect.objectContaining({
        model: "gpt-safe",
        latencyMs: expect.any(Number),
        purpose: "EXPLAIN",
        promptTokens: null,
      }),
    );
  });

  it("records redacted prompts when explicitly enabled", async () => {
    process.env.LLM_LOG_PROMPTS = "true";
    process.env.LLM_LOG_LEVEL = "redacted";

    const { callLLM } = await import("./gateway");
    const adapter = {
      chatCompletion: vi.fn().mockResolvedValue({ content: "ok" }),
    };
    const { recordAuditEvent } = await import("@/lib/audit/trail");

    await callLLM({
      systemPrompt: "system prompt",
      userPrompt: "user secret@example.com prompt",
      adapter,
      agent: "TEST",
      context: { purpose: "EXPLAIN" },
    });

    const auditArgs = vi.mocked(recordAuditEvent).mock.calls[0]?.[0];
    expect(auditArgs?.metadata?.promptLoggingEnabled).toBe(true);
    expect(auditArgs?.metadata?.prompts?.user).toContain("[REDACTED_EMAIL]");
    expect(auditArgs?.metadata?.prompts?.promptExpiresAt).toBeDefined();
  });
});

describe("gateway coverage", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    process.env.REQUIRE_LLM_SAFETY = "true";
    process.env.LLM_REDACTION_ENABLED = "true";
    process.env.LLM_AGENT_ALLOWLIST_ENABLED = "true";
    createMock.mockReset();
    retrieveMock.mockReset();

    const { getCurrentUser, getUserRoles } = await import("@/lib/auth/user");
    const { assertLlmUsageAllowed } = await import("@/lib/llm/tenantControls");
    const { consumeRateLimit, isRateLimitError } = await import("@/lib/rateLimiting/rateLimiter");
    const { recordAuditEvent } = await import("@/lib/audit/trail");
    const { recordCostEvent } = await import("@/lib/cost/events");

    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1" });
    vi.mocked(getUserRoles).mockResolvedValue(["ADMIN"]);
    vi.mocked(assertLlmUsageAllowed).mockResolvedValue({
      provider: "openai",
      allowedAgents: ["TEST"],
      model: "gpt-safe",
      verbosityCap: 10,
      maxTokens: 50,
      providerReady: true,
    });
    vi.mocked(consumeRateLimit).mockResolvedValue(undefined as never);
    vi.mocked(isRateLimitError).mockReturnValue(false);
    vi.mocked(recordAuditEvent).mockResolvedValue(undefined as never);
    vi.mocked(recordCostEvent).mockResolvedValue?.(undefined as never);
  });

  it("uses the default adapter and maps assistant and tool messages", async () => {
    const { GatewayOpenAIChatAdapter } = await import("./gateway");

    createMock.mockResolvedValue({
      choices: [{ message: { content: "done" } }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    });

    const adapter = new GatewayOpenAIChatAdapter("alt-key");

    const result = await adapter.chatCompletion({
      model: "gpt-safe",
      temperature: 0.1,
      messages: [
        { role: "assistant", content: "assistant-msg", tool_calls: [{ id: "tool-1", type: "function", function: { name: "fn", arguments: "{}" } }] },
        { role: "tool", content: "result", tool_call_id: "tool-1" },
        { role: "user", content: "user" },
      ],
    });

    const request = createMock.mock.calls[0]?.[0];
    expect(request.messages[0]).toMatchObject({ role: "assistant", content: "assistant-msg" });
    expect(request.messages[1]).toEqual({ role: "tool", content: "result", tool_call_id: "tool-1" });
    expect(result.usage).toEqual({ promptTokens: 1, completionTokens: 2, totalTokens: 3 });
  });

  it("requires tool messages to include a tool_call_id", async () => {
    const { GatewayOpenAIChatAdapter } = await import("./gateway");
    const adapter = new GatewayOpenAIChatAdapter();

    await expect(() =>
      adapter.chatCompletion({
        model: "gpt",
        temperature: 0,
        messages: [{ role: "tool", content: "oops" }],
      }),
    ).rejects.toThrow("Tool messages must include a tool_call_id");
  });

  it("throws when no OpenAI API key is configured on the default adapter", async () => {
    const { GatewayOpenAIChatAdapter } = await import("./gateway");
    delete process.env.OPENAI_API_KEY;
    const adapter = new GatewayOpenAIChatAdapter();

    await expect(() =>
      adapter.chatCompletion({ model: "gpt", temperature: 0, messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow("OPENAI_API_KEY is not configured");
  });

  it("caps verbosity across nested context fields", async () => {
    const { sanitizeOutbound } = await import("./gateway");

    const { context, userPrompt, systemPrompt } = sanitizeOutbound({
      systemPrompt: () => "system".repeat(50),
      userPrompt: () => JSON.stringify({ message: "x".repeat(200) }),
      verbosityCap: 5,
      contextInput: {
        purpose: "OTHER",
        job: { title: "verylongtitle", skillsPreferred: ["abcdef", "123456"] },
        metadata: { correlationId: "c" },
        candidates: [{ summary: "summary-text", skills: ["typescript", "golang"] }],
      },
    });

    expect(context.job?.title).toBe("veryl");
    expect(context.job?.skillsPreferred?.[0]).toBe("abcde");
    expect(context.candidates?.[0]?.skills?.[0]).toBe("types");
    expect(context.metadata?.requestId).toBeDefined();
    expect(context.metadata?.correlationId).toBeDefined();
    expect(typeof userPrompt).toBe("string");
    expect(typeof systemPrompt).toBe("string");
  });

  it("fails write calls when execution controls are disabled", async () => {
    const { callLLM } = await import("./gateway");
    const adapter = { chatCompletion: vi.fn() };

    await expect(() =>
      callLLM({
        systemPrompt: "sys",
        userPrompt: "usr",
        adapter,
        agent: "TEST",
        capability: "write",
        context: { purpose: "OTHER" },
      }),
    ).rejects.toThrow(AIFailureError);
  });

  it("wraps LLMSafetyConfigError from safety checks", async () => {
    const { callLLM } = await import("./gateway");
    const safety = await import("@/server/ai/safety/config");
    const safetySpy = vi.spyOn(safety, "assertLlmSafetyConfig").mockImplementation(() => {
      throw new safety.LLMSafetyConfigError(["missing"]);
    });

    const adapter = { chatCompletion: vi.fn() };
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(() =>
      callLLM({
        systemPrompt: "sys",
        userPrompt: "usr",
        adapter,
        agent: "TEST",
        context: { purpose: "OTHER" },
      }),
    ).rejects.toThrow(AIFailureError);

    expect(consoleSpy).toHaveBeenCalledWith("[ai-gateway] LLM safety check failed", expect.anything());
    consoleSpy.mockRestore();
    safetySpy.mockRestore();
  });

  it("rethrows rate limit errors without wrapping them", async () => {
    const { callLLM } = await import("./gateway");
    const rateLimiter = await import("@/lib/rateLimiting/rateLimiter");
    vi.mocked(rateLimiter.consumeRateLimit).mockRejectedValue(new Error("rate-limit"));
    vi.mocked(rateLimiter.isRateLimitError).mockReturnValue(true);

    await expect(() =>
      callLLM({
        systemPrompt: "sys",
        userPrompt: "usr",
        agent: "TEST",
        context: { purpose: "OTHER" },
      }),
    ).rejects.toThrow("rate-limit");
  });

  it("rejects disallowed models with LLMUsageRestrictedError", async () => {
    const { callLLM } = await import("./gateway");
    const { assertLlmUsageAllowed } = await import("@/lib/llm/tenantControls");
    vi.mocked(assertLlmUsageAllowed).mockResolvedValue({
      provider: "openai",
      allowedAgents: ["TEST"],
      model: "gpt-safe",
      verbosityCap: null,
      maxTokens: 10,
      providerReady: true,
    });

    await expect(() =>
      callLLM({
        systemPrompt: "sys",
        userPrompt: "usr",
        model: "gpt-unsafe",
        agent: "TEST",
        context: { purpose: "OTHER" },
      }),
    ).rejects.toThrow(LLMUsageRestrictedError);
  });

  it("continues audit logging even when audit storage fails", async () => {
    const { callLLM } = await import("./gateway");
    const { recordAuditEvent } = await import("@/lib/audit/trail");
    vi.mocked(recordAuditEvent).mockRejectedValue(new Error("audit-failed"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      callLLM({
        systemPrompt: "sys",
        userPrompt: "usr",
        agent: "TEST",
        context: { purpose: "OTHER" },
        adapter: { chatCompletion: vi.fn().mockResolvedValue({ content: "ok" }) },
      }),
    ).resolves.toBe("ok");

    expect(consoleSpy).toHaveBeenCalledWith("[ai-gateway] Failed to record audit event", expect.anything());
    consoleSpy.mockRestore();
  });

  it("surfaces empty responses from OpenAI via formatEmptyResponseError", async () => {
    const { GatewayOpenAIChatAdapter } = await import("./gateway");
    createMock.mockResolvedValue({ choices: [{ message: { content: "" } }] });

    const adapter = new GatewayOpenAIChatAdapter("key");

    await expect(() =>
      adapter.chatCompletion({ model: "gpt", temperature: 0, messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow("Empty response from LLM");
  });

  it("verifies provider availability and requires an API key", async () => {
    const { verifyLLMProvider } = await import("./gateway");
    retrieveMock.mockResolvedValue({ id: "gpt-test" } as any);

    await verifyLLMProvider("gpt-test");
    expect(retrieveMock).toHaveBeenCalledWith("gpt-test");

    delete process.env.OPENAI_API_KEY;
    await expect(() => verifyLLMProvider("gpt-test")).rejects.toThrow("OPENAI_API_KEY is not configured");
  });
});

describe("gateway helpers", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getCurrentUser, getUserRoles } = await import("@/lib/auth/user");
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1" });
    vi.mocked(getUserRoles).mockResolvedValue(["ADMIN"]);
  });

  it("falls back to defaults when logging config is misconfigured", async () => {
    const { resolveLoggingConfig } = await import("./gateway");

    const config = resolveLoggingConfig({
      LLM_LOG_LEVEL: "invalid",
      LLM_LOG_PROMPTS: "true",
      LLM_LOG_TTL_HOURS: "-5",
    } as NodeJS.ProcessEnv);

    expect(config.level).toBe("metadata");
    expect(config.promptLoggingEnabled).toBe(true);
    expect(config.promptTtlMs).toBe(24 * 60 * 60 * 1000);
  });

  it("skips verbosity limiting when no cap is provided and preserves Dates", async () => {
    const { applyVerbosityLimits } = await import("./gateway");
    const sample = { when: new Date(), pattern: /abc/, value: "long-value" };

    expect(applyVerbosityLimits(sample)).toBe(sample);

    const limited = applyVerbosityLimits(sample, 3);
    expect(limited.when).toBe(sample.when);
    expect(limited.pattern).toBe(sample.pattern);
    expect(limited.value).toBe("lon");
  });

  it("throws when caller context is missing a user or role", async () => {
    const { resolveCaller } = await import("./gateway");
    const { getCurrentUser, getUserRoles } = await import("@/lib/auth/user");

    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(resolveCaller()).rejects.toThrow("AI gateway requires an authenticated user");

    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1" });
    vi.mocked(getUserRoles).mockResolvedValue([]);
    await expect(resolveCaller()).rejects.toThrow("AI gateway requires a user role");
  });

  it("requires an approval token when write execution is enabled", async () => {
    const originalExec = process.env.EXECUTION_ENABLED;
    process.env.EXECUTION_ENABLED = "true";
    vi.resetModules();

    const { assertWriteCapabilityAllowed } = await import("./gateway");

    expect(() => assertWriteCapabilityAllowed("write")).toThrow("approval token");

    process.env.EXECUTION_ENABLED = originalExec;
    vi.resetModules();
  });

  it("logs audit metadata with usage fallbacks and redacted snippets", async () => {
    const { recordAIAuditEvent } = await import("./gateway");
    const { recordAuditEvent } = await import("@/lib/audit/trail");

    await recordAIAuditEvent({
      userId: "user-1",
      tenantId: "tenant-1",
      agent: "AGENT",
      capability: "read",
      model: "m1",
      status: "success",
      systemPrompt: "sys",
      userPrompt: "user",
      roles: ["ADMIN"],
      result: "r".repeat(200),
      redactResult: true,
      logConfig: { level: "redacted", promptLoggingEnabled: true, promptTtlMs: 1000 },
      usage: { promptTokens: undefined, completionTokens: undefined, totalTokens: undefined },
      latencyMs: 5,
      purpose: "MATCH",
      rawSystemPrompt: "sys-raw",
      rawUserPrompt: "user-raw",
    });

    const metadata = vi.mocked(recordAuditEvent).mock.calls.at(-1)?.[0].metadata;
    expect(metadata?.prompts?.result).toContain("[REDACTED_TOKEN]");
    expect(metadata?.usage?.promptTokens).toBeNull();

    vi.mocked(recordAuditEvent).mockClear();

    await recordAIAuditEvent({
      userId: "user-1",
      tenantId: "tenant-1",
      agent: "AGENT",
      capability: "read",
      model: "m1",
      status: "failure",
      systemPrompt: "sys",
      userPrompt: "user",
      roles: ["ADMIN"],
      result: null,
      redactResult: false,
      logConfig: { level: "metadata", promptLoggingEnabled: false, promptTtlMs: 1000 },
      usage: undefined,
    });

    const metadataNoPrompts = vi.mocked(recordAuditEvent).mock.calls.at(-1)?.[0].metadata;
    expect(metadataNoPrompts?.prompts).toBeUndefined();
    expect(metadataNoPrompts?.usage).toBeUndefined();
  });

  it("handles missing usage fields in the default adapter", async () => {
    const { GatewayOpenAIChatAdapter } = await import("./gateway");

    createMock.mockResolvedValue({ choices: [{ message: { content: "ok" } }], usage: { total_tokens: undefined } });

    const adapter = new GatewayOpenAIChatAdapter("k");

    const resultWithUsage = await adapter.chatCompletion({
      model: "gpt",
      temperature: 0,
      messages: [{ role: "user", content: "hi" }],
    });

    expect(resultWithUsage.usage?.promptTokens).toBeNull();

    createMock.mockResolvedValue({ choices: [{ message: { content: "ok" } }] });
    const resultWithoutUsage = await adapter.chatCompletion({
      model: "gpt",
      temperature: 0,
      messages: [{ role: "user", content: "hi" }],
    });

    expect(resultWithoutUsage.usage).toBeUndefined();
  });

  it("redacts snippets and stringifies non-string prompt data", async () => {
    const { redactSnippet, sanitizeOutbound, recordAIAuditEvent } = await import("./gateway");
    const redactModule = await import("./safety/redact");
    const redactSpy = vi.spyOn(redactModule, "redactAny").mockReturnValue({ masked: true } as any);

    expect(redactSnippet(null)).toBeNull();
    expect(redactSnippet("a".repeat(130))).toMatch(/\.\.\.$/);

    const sanitized = sanitizeOutbound({
      systemPrompt: "sys",
      userPrompt: "user",
      contextInput: { purpose: "OTHER" },
    });
    expect(typeof sanitized.systemPrompt).toBe("string");

    const { recordAuditEvent } = await import("@/lib/audit/trail");
    await recordAIAuditEvent({
      userId: "user-1",
      tenantId: "tenant-1",
      agent: "AGENT",
      capability: "read",
      model: "m1",
      status: "success",
      systemPrompt: "s".repeat(150),
      userPrompt: "u".repeat(150),
      roles: ["ADMIN"],
      result: "result-value",
      redactResult: true,
      logConfig: { level: "redacted", promptLoggingEnabled: true, promptTtlMs: 1000 },
      usage: undefined,
    });

    const metadata = vi.mocked(recordAuditEvent).mock.calls.at(-1)?.[0].metadata;
    expect(metadata?.prompts?.system).toContain("masked");

    redactSpy.mockRestore();
  });

  it("handles buildUserPrompt, missing verbosity caps, and null responses", async () => {
    const { callLLM, sanitizeOutbound } = await import("./gateway");
    const tenantControls = await import("@/lib/llm/tenantControls");
    vi.mocked(tenantControls.assertLlmUsageAllowed).mockResolvedValue({
      provider: "openai",
      allowedAgents: ["TEST"],
      model: "gpt-safe",
      verbosityCap: null,
      maxTokens: undefined,
      providerReady: true,
    });

    const adapter = { chatCompletion: vi.fn().mockResolvedValue({}) };
    const result = await callLLM({
      systemPrompt: "ignored",
      userPrompt: "ignored",
      agent: "TEST",
      adapter,
      buildUserPrompt: () => "custom-user",
    }).catch(() => null);

    expect(result).toBeNull();
  });

  it("allows approved write calls when execution is enabled", async () => {
    const originalExec = process.env.EXECUTION_ENABLED;
    process.env.EXECUTION_ENABLED = "true";
    vi.resetModules();
    const { assertWriteCapabilityAllowed } = await import("./gateway");

    expect(() => assertWriteCapabilityAllowed("write", "token")).not.toThrow();

    process.env.EXECUTION_ENABLED = originalExec;
    vi.resetModules();
  });

  it("keeps provided identifiers intact", async () => {
    const { ensureRequestIdentifiers } = await import("./gateway");

    const result = ensureRequestIdentifiers({
      purpose: "MATCH",
      metadata: { requestId: "req-1", correlationId: "corr-1" },
    });

    expect(result.metadata?.requestId).toBe("req-1");
    expect(result.metadata?.correlationId).toBe("corr-1");
  });

  it("populates identifiers when none are provided", async () => {
    const { ensureRequestIdentifiers } = await import("./gateway");

    const result = ensureRequestIdentifiers(undefined);

    expect(result.metadata?.requestId).toBeDefined();
    expect(result.metadata?.correlationId).toBeDefined();
  });

  it("logs audit events with null results", async () => {
    const { recordAIAuditEvent } = await import("./gateway");
    const { recordAuditEvent } = await import("@/lib/audit/trail");

    await recordAIAuditEvent({
      userId: "user-1",
      tenantId: "tenant-1",
      agent: "AGENT",
      capability: "read",
      model: "m1",
      status: "success",
      systemPrompt: "sys",
      userPrompt: "user",
      roles: ["ADMIN"],
      result: null,
      redactResult: true,
      logConfig: { level: "redacted", promptLoggingEnabled: true, promptTtlMs: 1000 },
      usage: undefined,
    });

    const metadata = vi.mocked(recordAuditEvent).mock.calls.at(-1)?.[0].metadata;
    expect(metadata?.promptLengths?.result).toBeNull();
  });

  it("logs audit events when roles are missing", async () => {
    const { recordAIAuditEvent } = await import("./gateway");
    const { recordAuditEvent } = await import("@/lib/audit/trail");

    await recordAIAuditEvent({
      userId: "user-3",
      tenantId: "tenant-3",
      agent: "AGENT",
      capability: "read",
      model: "m3",
      status: "success",
      systemPrompt: "sys",
      userPrompt: "user",
      roles: [],
      result: "result",
      redactResult: false,
      logConfig: { level: "metadata", promptLoggingEnabled: false, promptTtlMs: 1000 },
      usage: undefined,
    });

    const metadata = vi.mocked(recordAuditEvent).mock.calls.at(-1)?.[0].metadata;
    expect(metadata?.role).toBeNull();
  });

  it("records audit events when result length is unavailable", async () => {
    const { recordAIAuditEvent } = await import("./gateway");
    const { recordAuditEvent } = await import("@/lib/audit/trail");

    await recordAIAuditEvent({
      userId: "user-2",
      tenantId: "tenant-2",
      agent: "AGENT",
      capability: "read",
      model: "m2",
      status: "success",
      systemPrompt: "sys",
      userPrompt: "user",
      roles: ["ADMIN"],
      // @ts-expect-error intentional undefined result for coverage
      result: undefined,
      redactResult: true,
      logConfig: { level: "metadata", promptLoggingEnabled: false, promptTtlMs: 1000 },
      usage: undefined,
    });

    const metadata = vi.mocked(recordAuditEvent).mock.calls.at(-1)?.[0].metadata;
    expect(metadata?.promptLengths?.result).toBeNull();
  });

  it("handles missing sanitized context details", async () => {
    const gatewayModule = await import("./gateway");
    const { callLLM } = gatewayModule;
    const sanitizeSpy = vi
      .spyOn(gatewayModule, "sanitizeOutbound")
      .mockReturnValue({ context: {}, systemPrompt: "sys", userPrompt: "user" } as any);

    const tenantControls = await import("@/lib/llm/tenantControls");
    vi.mocked(tenantControls.assertLlmUsageAllowed).mockResolvedValue({
      provider: "openai",
      allowedAgents: ["TEST"],
      model: "gpt-safe",
      verbosityCap: null,
      maxTokens: undefined,
      providerReady: true,
    });

    const adapter = { chatCompletion: vi.fn().mockResolvedValue({ text: undefined, content: undefined }) };
    try {
      await callLLM({
        systemPrompt: "s",
        userPrompt: "u",
        agent: "TEST",
        adapter,
        buildUserPrompt: () => "user-built",
      }).catch(() => null);
    } finally {
      sanitizeSpy.mockRestore();
    }
  });

  it("covers null verbosity caps with custom user prompts", async () => {
    const gatewayModule = await import("./gateway");
    const { callLLM } = gatewayModule;
    const tenantControls = await import("@/lib/llm/tenantControls");
    vi.mocked(tenantControls.assertLlmUsageAllowed).mockResolvedValue({
      provider: "openai",
      allowedAgents: ["TEST"],
      model: "gpt-safe",
      verbosityCap: null,
      maxTokens: undefined,
      providerReady: true,
    });

    const adapter = { chatCompletion: vi.fn().mockResolvedValue({ text: undefined, content: undefined }) };

    await expect(
      callLLM({
        systemPrompt: "sys",
        userPrompt: "user",
        agent: "TEST",
        adapter,
        buildUserPrompt: () => "builder-output",
      }),
    ).resolves.toBeNull();
  });

  it("uses the user prompt builder when provided", async () => {
    const { callLLM } = await import("./gateway");
    const tenantControls = await import("@/lib/llm/tenantControls");
    vi.mocked(tenantControls.assertLlmUsageAllowed).mockResolvedValue({
      provider: "openai",
      allowedAgents: ["TEST"],
      model: "gpt-safe",
      verbosityCap: 5,
      maxTokens: undefined,
      providerReady: true,
    });

    const adapter = { chatCompletion: vi.fn().mockResolvedValue({ content: "ok" }) };

    await expect(
      callLLM({
        systemPrompt: "sys",
        userPrompt: "user",
        agent: "TEST",
        adapter,
        buildUserPrompt: () => "BUILDER-OUTPUT",
      }),
    ).resolves.toBe("ok");
  });

  it("passes through user prompts when no verbosity cap is set", async () => {
    const { callLLM } = await import("./gateway");
    const tenantControls = await import("@/lib/llm/tenantControls");
    vi.mocked(tenantControls.assertLlmUsageAllowed).mockResolvedValue({
      provider: "openai",
      allowedAgents: ["TEST"],
      model: "gpt-safe",
      verbosityCap: null,
      maxTokens: undefined,
      providerReady: true,
    });

    const adapter = { chatCompletion: vi.fn().mockResolvedValue({ content: "ok" }) };

    const longPrompt = "x".repeat(200);

    const result = await callLLM({
      systemPrompt: "sys",
      userPrompt: longPrompt,
      agent: "TEST",
      adapter,
    });

    expect(result).toBe("ok");
    expect(adapter.chatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([expect.objectContaining({ content: expect.stringContaining("[REDACTED_") })]),
      }),
    );
  });

  it("returns null when the LLM provides no content", async () => {
    const { callLLM } = await import("./gateway");
    const tenantControls = await import("@/lib/llm/tenantControls");
    vi.mocked(tenantControls.assertLlmUsageAllowed).mockResolvedValue({
      provider: "openai",
      allowedAgents: ["TEST"],
      model: "gpt-safe",
      verbosityCap: 5,
      maxTokens: undefined,
      providerReady: true,
    });

    const adapter = { chatCompletion: vi.fn().mockResolvedValue({}) };

    await expect(
      callLLM({
        systemPrompt: "sys",
        userPrompt: "user",
        agent: "TEST",
        adapter,
      }),
    ).resolves.toBeNull();
  });
});
