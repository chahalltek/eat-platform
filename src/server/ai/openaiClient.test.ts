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
});
