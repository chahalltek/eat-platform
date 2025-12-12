export type ChatMessage = {
  role: 'system' | 'user';
  content: string;
};

export type ChatCompletionParams = {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens?: number;
};

export interface OpenAIAdapter {
  chatCompletion(params: ChatCompletionParams): Promise<string>;
}

export function formatEmptyResponseError(): Error {
  return new Error('Empty response from LLM');
}
