import OpenAI from "openai";
import { type ChatCompletionMessageParam } from "openai/resources/chat/completions";

import {
<<<<<<< ours
  ChatCompletionParams,
=======
>>>>>>> theirs
  ChatMessage,
  formatEmptyResponseError,
  type ChatCompletionResult,
  type OpenAIAdapter,
} from "@/lib/llm/openaiAdapter";
import { redactAny } from "./safety/redact";

export class OpenAIChatAdapter implements OpenAIAdapter {
  constructor(private apiKey = process.env.OPENAI_API_KEY) {}

  async chatCompletion({
    model,
    messages,
    temperature,
    maxTokens,
<<<<<<< ours
  }: ChatCompletionParams): Promise<ChatCompletionResult> {
=======
  }: {
    model: string;
    messages: ChatMessage[];
    temperature: number;
    maxTokens?: number;
  }): Promise<ChatCompletionResult> {
>>>>>>> theirs
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const redactedMessages = redactAny(messages) as ChatMessage[];

    const request = {
      model,
      messages: redactedMessages as ChatCompletionMessageParam[],
      temperature,
      max_tokens: maxTokens,
    };

    const client = new OpenAI({ apiKey: this.apiKey });

    const response = await client.chat.completions.create(request).catch(error => {
      console.error("[openai-client] chatCompletion failed", { error, request });
      throw error;
    });

    const content = response.choices?.[0]?.message?.content;

    if (!content) throw formatEmptyResponseError();

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
