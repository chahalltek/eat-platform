import OpenAI from "openai";

import { ChatMessage, formatEmptyResponseError, type OpenAIAdapter } from "@/lib/llm/openaiAdapter";

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

    const response = await new OpenAI({ apiKey: this.apiKey }).chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) throw formatEmptyResponseError();

    return content;
  }
}
