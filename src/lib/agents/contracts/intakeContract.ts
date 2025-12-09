// src/lib/agents/contracts/intakeContract.ts
import {
  assertValidRuaResponse,
  RUA_PROMPT_VERSION,
  type RuaLLMResponse,
} from "@/lib/agents/contracts/ruaContract";

export type JobIntakeProfile = RuaLLMResponse;

export const INTAKE_PROMPT_VERSION = RUA_PROMPT_VERSION;

export function assertValidJobIntakeProfile(payload: unknown): JobIntakeProfile {
  return assertValidRuaResponse(payload);
}
