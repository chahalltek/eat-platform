import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes outbound calls through sanitizeOutbound before hitting the adapter", async () => {
    const { callLLM } = await import("./gateway");
    const adapter = {
      chatCompletion: vi.fn().mockResolvedValue("ok"),
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
});
