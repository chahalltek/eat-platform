// src/lib/agents/rina.ts
import {
  assertValidRinaResponse,
  RINA_PROMPT_VERSION,
  type RinaLLMResponse,
} from '@/lib/agents/contracts/rinaContract';
import { AGENT_PROMPTS, resolveAgentPrompt } from '@/lib/agents/promptRegistry';
import { AgentRetryMetadata, withAgentRun } from '@/lib/agents/agentRun';
import { callLLM } from '@/lib/llm';
import { OpenAIAdapter } from '@/lib/llm/openaiAdapter';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/server/db';
import type { IdentityUser } from '@/lib/auth/identityProvider';
import { DEFAULT_TENANT_ID } from '@/lib/auth/config';

export {
  assertValidRinaResponse,
  RINA_PROMPT_VERSION,
  type RinaLLMResponse,
} from '@/lib/agents/contracts/rinaContract';

export type RinaInput = {
  rawResumeText: string;
  sourceType?: string;
  sourceTag?: string;
  currentUser?: IdentityUser | null;
};

export async function runRina(
  input: RinaInput,
  retryMetadata?: AgentRetryMetadata,
  llmAdapter?: OpenAIAdapter,
): Promise<{ candidateId: string; agentRunId: string }> {
  const { rawResumeText, sourceType, sourceTag, currentUser } = input;
  const normalizedRawResumeText = rawResumeText.trim();
  const user =
    currentUser ??
    (await getCurrentUser()) ?? {
      id: 'anonymous-recruiter',
      tenantId: DEFAULT_TENANT_ID,
      role: 'recruiter',
      email: null,
      displayName: null,
    };

  if (!user) {
    throw new Error('Current user is required to run RINA agent');
  }

  // User identity is derived from auth; recruiterId in payload is ignored.

  const promptContract =
    (await resolveAgentPrompt(AGENT_PROMPTS.RINA_SYSTEM, {
      version: RINA_PROMPT_VERSION,
    })) ?? ({ prompt: '', version: RINA_PROMPT_VERSION } as const);

  const [result, agentRunId] = await withAgentRun<{ candidateId: string }>(
    {
      agentName: 'ETE-TS.RINA',
      recruiterId: user.id,
      inputSnapshot: {
        rawResumeText: normalizedRawResumeText.slice(0, 4000),
        sourceType,
        sourceTag,
        promptVersion: promptContract.version,
      },
      sourceType,
      sourceTag,
      retryPayload: {
        rawResumeText: normalizedRawResumeText,
        sourceType,
        sourceTag,
      },
      ...retryMetadata,
    },
    async () => {
      const userPrompt = `Resume:\n"""\n${normalizedRawResumeText}\n"""`;

      const llmRaw = await callLLM({
        systemPrompt: promptContract.prompt,
        userPrompt,
        adapter: llmAdapter,
        agent: 'RINA',
      });

      let parsed: RinaLLMResponse;
      try {
        parsed = JSON.parse(llmRaw) as RinaLLMResponse;
      } catch (err) {
        console.error('Failed to parse LLM JSON for RINA:', err, llmRaw);
        throw new Error('Failed to parse LLM JSON');
      }

      assertValidRinaResponse(parsed);

      const candidate = await prisma.candidate.create({
        data: {
          fullName: parsed.fullName,
          email: parsed.email ?? null,
          phone: parsed.phone ?? null,
          location: parsed.location ?? null,
          currentTitle: parsed.currentTitle ?? null,
          currentCompany: parsed.currentCompany ?? null,
          totalExperienceYears: parsed.totalExperienceYears ?? null,
          seniorityLevel: parsed.seniorityLevel ?? null,
          summary: parsed.summary ?? null,
          rawResumeText: normalizedRawResumeText,
          sourceType: sourceType ?? null,
          sourceTag: sourceTag ?? null,
          parsingConfidence: parsed.parsingConfidence ?? null,
          skills: {
            create: parsed.skills.map((skill) => ({
              name: skill.name,
              normalizedName: skill.normalizedName || skill.name,
              proficiency: skill.proficiency ?? null,
              yearsOfExperience: skill.yearsOfExperience ?? null,
            })),
          },
        },
      });

      return {
        result: { candidateId: candidate.id },
        outputSnapshot: parsed,
      };
    },
  );

  return {
    ...result,
    agentRunId,
  };
}
