import { describe, expect, it, vi } from "vitest";

const { gatewayCallLLM, gatewayVerify } = vi.hoisted(() => ({
  gatewayCallLLM: vi.fn(async (params: unknown) => ({ ok: true, params })),
  gatewayVerify: vi.fn(),
}));

vi.mock("@/server/ai/gateway", () => ({
  callLLM: gatewayCallLLM,
  verifyLLMProvider: gatewayVerify,
}));

import { callLLM, verifyLLMProvider } from "@/lib/llm";

describe("lib/llm", () => {
  it("delegates callLLM to the gateway", async () => {
    const params = { systemPrompt: "s", userPrompt: "u", agent: "agent-1" };
    const result = await callLLM(params);

    expect(result).toEqual({ ok: true, params });
    expect(gatewayCallLLM).toHaveBeenCalledWith(params);
  });

  it("re-exports verifyLLMProvider from the gateway", async () => {
    await verifyLLMProvider();
    expect(gatewayVerify).toHaveBeenCalled();
  });
});
