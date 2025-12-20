<<<<<<< ours
import { callLLM as gatewayCallLLM, type CallLLMParams } from '@/server/ai/gateway';
=======
import { callLLM as gatewayCallLLM, type CallLLMParams } from "@/server/ai/gateway";
>>>>>>> theirs

export type { CallLLMParams };

export async function callLLM(params: CallLLMParams): Promise<string> {
  return gatewayCallLLM(params);
}
