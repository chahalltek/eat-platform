import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatMessage } from "@/lib/llm/openaiAdapter";
import { OpenAIChatAdapter } from "./openaiClient";

const createMock = vi.fn();
const mockOpenAIClient = () => ({
  chat: {
    completions: {
      create: createMock,
    },
  },
});

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = mockOpenAIClient().chat;
    },
  };
});

describe("OpenAIChatAdapter", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    createMock.mockReset();
  });

  it("redacts messages before sending them to OpenAI", async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: "ok" } }] });
    const adapter = new OpenAIChatAdapter();

    const userToken = "token=123456789012345678901234567890123456";

    const toolArguments =
      '{"token":"token=123456789012345678901234567890123456","note":"contact me at a@example.com"}';

    const messages: ChatMessage[] = [
      { role: "system", content: "System message with a@example.com" },
      { role: "user", content: `Payload ${userToken}` },
      {
        role: "assistant",
        content: "Calling tool",
        tool_calls: [
          {
            id: "call-1",
            type: "function",
            function: { name: "do-something", arguments: toolArguments },
          },
        ],
      },
    ];

    await adapter.chatCompletion({
      model: "gpt-test",
      messages,
      temperature: 0.1,
      maxTokens: 200,
    });

    expect(createMock).toHaveBeenCalledTimes(1);

    const request = createMock.mock.calls[0][0];

    const serialized = JSON.stringify(request);

    expect(serialized).not.toContain("a@example.com");
    expect(serialized).not.toContain(userToken);
    expect(serialized).toContain("[REDACTED");
    expect(request.messages[0].content).toContain("[REDACTED_EMAIL]");
    expect(request.messages[1].content).toContain("[REDACTED");
    expect(
      request.messages[2].tool_calls?.[0].function.arguments
    ).toContain("[REDACTED");
  });

  it("logs only redacted request data when the call fails", async () => {
    const error = new Error("boom");
    createMock.mockRejectedValue(error);
    const adapter = new OpenAIChatAdapter();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const rawEmail = "secret@example.com";

    await expect(() =>
      adapter.chatCompletion({
        model: "gpt-test",
        messages: [
          { role: "system", content: `System with ${rawEmail}` },
          { role: "user", content: "hello" },
        ],
        temperature: 0.4,
      })
    ).rejects.toThrow(error);

    expect(consoleSpy).toHaveBeenCalled();

    const loggedRequest = consoleSpy.mock.calls[0][1].request;
    const serialized = JSON.stringify(loggedRequest);

    expect(serialized).not.toContain(rawEmail);
    expect(serialized).toContain("[REDACTED_EMAIL]");

    consoleSpy.mockRestore();
  });

  it("requires an API key before making requests", async () => {
    delete process.env.OPENAI_API_KEY;
    const adapter = new OpenAIChatAdapter();

    await expect(() =>
      adapter.chatCompletion({
        model: "gpt-test",
        messages: [{ role: "user", content: "hi" }],
        temperature: 0.1,
      })
    ).rejects.toThrow("OPENAI_API_KEY is not configured");
  });

  it("throws when OpenAI returns an empty message", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    createMock.mockResolvedValue({ choices: [{ message: { content: null } }] });

    const adapter = new OpenAIChatAdapter();

    await expect(() =>
      adapter.chatCompletion({
        model: "gpt-test",
        messages: [{ role: "user", content: "hi" }],
        temperature: 0.1,
      })
    ).rejects.toThrow("Empty response from LLM");
  });

  it("falls back to null token counts when usage fields are missing", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: undefined, completion_tokens: undefined, total_tokens: undefined },
    });

    const adapter = new OpenAIChatAdapter();
    const result = await adapter.chatCompletion({
      model: "gpt-test",
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.1,
    });

    expect(result.usage).toEqual({ promptTokens: null, completionTokens: null, totalTokens: null });
  });

  it("omits usage completely when OpenAI does not provide it", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: "ok" } }],
    });

    const adapter = new OpenAIChatAdapter();
    const result = await adapter.chatCompletion({
      model: "gpt-test",
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.1,
    });

    expect(result.usage).toBeUndefined();
  });
});
