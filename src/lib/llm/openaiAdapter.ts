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
  tool_call_id?: string;
};

export type ChatCompletionParams = {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens?: number;
};

export type ChatCompletionUsage = {
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
};

export type ChatCompletionResult = {
  /**
   * Primary text response from the model.
   */
  text: string;
  /**
   * Legacy alias for `text`. Kept for backwards compatibility while
   * callers migrate to the new shape.
   */
  content?: string;
  usage?: ChatCompletionUsage;
};

export interface OpenAIAdapter {
  chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult>;
}

export function formatEmptyResponseError(): Error {
  return new Error('Empty response from LLM');
}
