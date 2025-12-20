import {
  callLLM as gatewayCallLLM,
  verifyLLMProvider as gatewayVerifyLLMProvider,
  type CallLLMParams,
} from "@/server/ai/gateway";

export type { CallLLMParams };
export const verifyLLMProvider = gatewayVerifyLLMProvider;

export async function callLLM(params: CallLLMParams): Promise<string> {
  return gatewayCallLLM(params);
}
