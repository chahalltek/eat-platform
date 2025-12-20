import { describe, expect, it, vi, beforeEach } from "vitest";

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
  isRateLimitError: () => false,
  RATE_LIMIT_ACTIONS: { AGENT_RUN: "AGENT_RUN" },
}));

vi.mock("@/lib/cost/events", () => ({
  recordCostEvent: vi.fn(),
}));

vi.mock("@/lib/audit/trail", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

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
