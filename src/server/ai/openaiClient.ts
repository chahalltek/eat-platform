import OpenAI from "openai";
import { type ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { ChatMessage, formatEmptyResponseError, type OpenAIAdapter } from "@/lib/llm/openaiAdapter";
import { redactAny } from "./safety/redact";

export class OpenAIChatAdapter implements OpenAIAdapter {
  constructor(private apiKey = process.env.OPENAI_API_KEY) {}

  async chatCompletion({
    model,
    messages,
    temperature,
    maxTokens,
  }: {
    model: string;
    messages: ChatMessage[];
    temperature: number;
    maxTokens?: number;
  }): Promise<string> {
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

    const content = response.choices[0]?.message?.content;

    if (!content) throw formatEmptyResponseError();

    return content;
  }
}
