type ToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
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
