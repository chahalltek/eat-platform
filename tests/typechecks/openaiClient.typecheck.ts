import { type OpenAIAdapter } from "@/lib/llm/openaiAdapter";
import { OpenAIChatAdapter } from "@/server/ai/openaiClient";

// Compile-time assertion: OpenAIChatAdapter must satisfy OpenAIAdapter.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _openAIChatAdapterContractCheck: OpenAIAdapter = new OpenAIChatAdapter();
