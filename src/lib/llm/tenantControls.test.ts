import { describe, expect, it, vi } from "vitest";

import {
  LLMUsageRestrictedError,
  assertLlmUsageAllowed,
  type TenantLLMControls,
} from "@/lib/llm/tenantControls";

const mockLoadTenantGuardrails = vi.hoisted(() => vi.fn());
const mockIsFeatureEnabled = vi.hoisted(() => vi.fn());
const mockGetOpenAIApiKey = vi.hoisted(() => vi.fn());
const mockGetAzureOpenAIApiKey = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tenant/guardrails", () => ({
  loadTenantGuardrails: mockLoadTenantGuardrails,
}));

vi.mock("@/lib/featureFlags", () => ({
  isFeatureEnabledForTenant: mockIsFeatureEnabled,
}));

vi.mock("@/lib/featureFlags/constants", () => ({
  FEATURE_FLAGS: { FIRE_DRILL_MODE: "FIRE_DRILL_MODE" },
}));

vi.mock("@/server/config/secrets", () => ({
  getOpenAIApiKey: mockGetOpenAIApiKey,
  getAzureOpenAIApiKey: mockGetAzureOpenAIApiKey,
}));

async function expectRestriction(message: string) {
  await expect(
    assertLlmUsageAllowed({
      tenantId: "tenant-1",
      agent: "TEST_AGENT",
    }),
  ).rejects.toThrowError(new LLMUsageRestrictedError(message));
}

function buildGuardrails(overrides: Partial<TenantLLMControls> = {}) {
  return {
    llm: {
      provider: "openai",
      model: "gpt-4o-mini",
      allowedAgents: ["TEST_AGENT"],
      maxTokens: 128,
      verbosityCap: 100,
      ...overrides,
    },
  };
}

describe("assertLlmUsageAllowed", () => {
  it("allows configured tenants and marks provider readiness", async () => {
    mockIsFeatureEnabled.mockResolvedValue(false);
    mockGetOpenAIApiKey.mockReturnValue("sk-key");
    mockLoadTenantGuardrails.mockResolvedValue(buildGuardrails());

    const controls = await assertLlmUsageAllowed({ agent: "test_agent", tenantId: "tenant-a" });

    expect(controls.providerReady).toBe(true);
    expect(controls.model).toBe("gpt-4o-mini");
    expect(mockLoadTenantGuardrails).toHaveBeenCalledWith("tenant-a");
  });

  it("supports azure OpenAI credentials", async () => {
    mockIsFeatureEnabled.mockResolvedValue(false);
    mockGetAzureOpenAIApiKey.mockReturnValue("azure-key");
    mockGetOpenAIApiKey.mockReturnValue(null);
    mockLoadTenantGuardrails.mockResolvedValue(buildGuardrails({ provider: "azure-openai" }));

    const controls = await assertLlmUsageAllowed({ agent: "TEST_AGENT", tenantId: "tenant-b" });

    expect(controls.providerReady).toBe(true);
  });

  it("requires allowlisted agents", async () => {
    mockIsFeatureEnabled.mockResolvedValue(false);
    mockGetOpenAIApiKey.mockReturnValue("sk-key");
    mockLoadTenantGuardrails.mockResolvedValue(buildGuardrails({ allowedAgents: ["OTHER_AGENT"] }));

    await expectRestriction("This agent is not authorized to call LLMs for this tenant.");
  });

  it("blocks disabled providers", async () => {
    mockIsFeatureEnabled.mockResolvedValue(false);
    mockGetOpenAIApiKey.mockReturnValue("sk-key");
    mockLoadTenantGuardrails.mockResolvedValue(buildGuardrails({ provider: "disabled" }));

    await expectRestriction("LLM provider disabled for this tenant.");
  });

  it("fails when credentials are missing", async () => {
    mockIsFeatureEnabled.mockResolvedValue(false);
    mockGetOpenAIApiKey.mockReturnValue(null);
    mockLoadTenantGuardrails.mockResolvedValue(buildGuardrails({ provider: "openai" }));

    await expectRestriction("LLM provider credentials are missing or unavailable.");
  });

  it("blocks fire drill mode", async () => {
    mockIsFeatureEnabled.mockResolvedValue(true);
    mockGetOpenAIApiKey.mockReturnValue("sk-key");
    mockLoadTenantGuardrails.mockResolvedValue(buildGuardrails());

    await expectRestriction("LLM usage is blocked by Fire Drill mode.");
  });
});
