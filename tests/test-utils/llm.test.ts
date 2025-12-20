import { describe, expect, it } from "vitest";

import { createMockCallLLM } from "./llm";

describe("createMockCallLLM", () => {
  it("returns queued responses and falls back deterministically", async () => {
    const llm = createMockCallLLM({
      responses: ["first", ({ userPrompt }) => `echo:${userPrompt}`],
      fallbackResponse: "fallback",
    });

    expect(await llm.mockCallLLM({ systemPrompt: "s", userPrompt: "u1", agent: "a" })).toBe("first");
    expect(await llm.mockCallLLM({ systemPrompt: "s", userPrompt: "u2", agent: "a" })).toBe("echo:u2");
    expect(await llm.mockCallLLM({ systemPrompt: "s", userPrompt: "u3", agent: "a" })).toBe("fallback");
  });

  it("lets tests append and reset responses", async () => {
    const llm = createMockCallLLM({ responses: "initial", fallbackResponse: "fallback" });

    expect(await llm.mockCallLLM({ systemPrompt: "s", userPrompt: "u1", agent: "a" })).toBe("initial");

    llm.respondWith("next");
    expect(await llm.mockCallLLM({ systemPrompt: "s", userPrompt: "u2", agent: "a" })).toBe("next");

    llm.resetResponses(["reset"]);
    expect(await llm.mockCallLLM({ systemPrompt: "s", userPrompt: "u3", agent: "a" })).toBe("reset");
  });
});
