// src/lib/agents/rina.ts
import {
  assertValidRinaResponse,
  RINA_SYSTEM_PROMPT,
  type RinaLLMResponse,
} from '@/lib/agents/contracts/rinaContract';
import { AgentRetryMetadata, withAgentRun } from '@/lib/agents/agentRun';
import { callLLM } from '@/lib/llm';
import { OpenAIAdapter } from '@/lib/llm/openaiAdapter';
import { prisma } from '@/lib/prisma';

export type RinaInput = {
  recruiterId?: string;
  rawResumeText: string;
  sourceType?: string;
  sourceTag?: string;
};

export async function runRina(
  input: RinaInput,
  retryMetadata?: AgentRetryMetadata,
  llmAdapter?: OpenAIAdapter,
): Promise<{ candidateId: string; agentRunId: string }> {
  const { recruiterId, rawResumeText, sourceType, sourceTag } = input;

  const [result, agentRunId] = await withAgentRun<{ candidateId: string }>(
    {
      agentName: 'EAT-TS.RINA',
      recruiterId,
      inputSnapshot: {
        rawResumeText: rawResumeText.slice(0, 4000),
        sourceType,
        sourceTag,
      },
      sourceType,
      sourceTag,
      ...retryMetadata,
    },
    async () => {
      const userPrompt = `Resume:\n"""\n${rawResumeText}\n"""`;

      const llmRaw = await callLLM({
        systemPrompt: RINA_SYSTEM_PROMPT,
        userPrompt,
        adapter: llmAdapter,
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
          rawResumeText,
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
