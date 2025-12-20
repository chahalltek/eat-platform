import { ChatCompletionParams, OpenAIAdapter, type ChatCompletionResult } from '@/lib/llm/openaiAdapter';

type MockResponse = string | (() => string | Promise<string>);

export class MockOpenAIAdapter implements OpenAIAdapter {
  private responses: MockResponse[] = [];
  readonly calls: ChatCompletionParams[] = [];

  enqueue(response: MockResponse): void {
    this.responses.push(response);
  }

  reset(): void {
    this.responses = [];
    this.calls.length = 0;
  }

  async chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
    this.calls.push(params);

    const next = this.responses.shift();
    if (!next) {
      throw new Error('No mock LLM responses left in queue');
    }

    const value = typeof next === 'function' ? await next() : next;
    return { content: value };
  }
}
