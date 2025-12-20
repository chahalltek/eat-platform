import { callLLM as gatewayCallLLM, type CallLLMParams } from '@/server/ai/gateway';

export type { CallLLMParams };

export async function callLLM(params: CallLLMParams): Promise<string> {
  return gatewayCallLLM(params);
}
