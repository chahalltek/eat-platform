import {
  assertValidRinaResponse,
  RINA_PROMPT_VERSION,
  RINA_SYSTEM_PROMPT,
  type RinaLLMResponse,
} from "@/lib/agents/contracts/rinaContract";

export type CandidateProfile = RinaLLMResponse;

export const PROFILE_PROMPT_VERSION = RINA_PROMPT_VERSION;
export const PROFILE_SYSTEM_PROMPT = RINA_SYSTEM_PROMPT;

export function assertValidCandidateProfile(payload: unknown): CandidateProfile {
  return assertValidRinaResponse(payload);
}
