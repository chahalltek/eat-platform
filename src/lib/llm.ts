import OpenAI from 'openai';

import {
  ChatMessage,
  OpenAIAdapter,
  formatEmptyResponseError,
} from '@/lib/llm/openaiAdapter';

type CallLLMParams = {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  adapter?: OpenAIAdapter;
};

class OpenAIChatAdapter implements OpenAIAdapter {
  constructor(private apiKey = process.env.OPENAI_API_KEY) {}

  async chatCompletion({ model, messages, temperature }: { model: string; messages: ChatMessage[]; temperature: number; }): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const response = await new OpenAI({ apiKey: this.apiKey }).chat.completions.create({
      model,
      messages,
      temperature,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw formatEmptyResponseError();
    }

    return content;
  }
}

export async function callLLM({
  systemPrompt,
  userPrompt,
  model = 'gpt-4.1-mini',
  adapter = new OpenAIChatAdapter(),
}: CallLLMParams): Promise<string> {
  try {
    return await adapter.chatCompletion({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    });
  } catch (err) {
    console.error('Error calling LLM:', err);
    throw new Error('LLM call failed');
  }
}
