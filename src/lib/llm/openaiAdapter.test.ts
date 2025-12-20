import { describe, expect, it } from "vitest";

import {
  formatEmptyResponseError,
  type ChatCompletionParams,
} from "@/lib/llm/openaiAdapter";
import { MockOpenAIAdapter } from "@/lib/llm/mockOpenAIAdapter";

describe("openaiAdapter helpers", () => {
  it("creates a consistent empty response error", () => {
    const error = formatEmptyResponseError();

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Empty response from LLM");
  });

  it("enqueues and drains mock responses in order", async () => {
    const adapter = new MockOpenAIAdapter();
    adapter.enqueue("first");
    adapter.enqueue(() => "second");

    const params: ChatCompletionParams = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "hello" },
        { role: "user", content: "world" },
      ],
      temperature: 0.5,
      maxTokens: 10,
    };

    const first = await adapter.chatCompletion(params);
    const second = await adapter.chatCompletion(params);

    expect(first.text).toBe("first");
    expect(second.text).toBe("second");
    expect(adapter.calls).toHaveLength(2);
  });

  it("resets the queue and throws when empty", async () => {
    const adapter = new MockOpenAIAdapter();
    adapter.enqueue("value");

    await adapter.chatCompletion({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "ping" }],
      temperature: 0.2,
    });

    adapter.reset();

    await expect(
      adapter.chatCompletion({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "ping" }],
        temperature: 0.2,
      }),
    ).rejects.toThrowError("No mock LLM responses left in queue");
    expect(adapter.calls).toHaveLength(1);
  });
});
