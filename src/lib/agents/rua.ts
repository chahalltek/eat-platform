// src/lib/agents/rua.ts
import {
  assertValidRuaResponse,
  RUA_PROMPT_VERSION,
  type RuaLLMResponse,
} from '@/lib/agents/contracts/ruaContract';
import { AGENT_PROMPTS, resolveAgentPrompt } from '@/lib/agents/promptRegistry';
import { AgentRetryMetadata, withAgentRun } from '@/lib/agents/agentRun';
import { callLLM } from '@/lib/llm';
import { OpenAIAdapter } from '@/lib/llm/openaiAdapter';
import { prisma } from '@/lib/prisma';
import { getCurrentTenantId } from '@/lib/tenant';

export type RuaInput = {
  recruiterId?: string;
  rawJobText: string;
  sourceType?: string;
  sourceTag?: string;
};

export async function runRua(
  input: RuaInput,
  retryMetadata?: AgentRetryMetadata,
  llmAdapter?: OpenAIAdapter,
): Promise<{ jobReqId: string; agentRunId: string }> {
  const { recruiterId, rawJobText, sourceType, sourceTag } = input;
  const tenantId = await getCurrentTenantId();

  const promptContract = await resolveAgentPrompt(AGENT_PROMPTS.RUA_SYSTEM, {
    version: RUA_PROMPT_VERSION,
  });

  const [result, agentRunId] = await withAgentRun<{ jobReqId: string }>(
    {
      agentName: 'ETE-TS.RUA',
      recruiterId,
      inputSnapshot: {
        recruiterId: recruiterId ?? null,
        rawJobText: rawJobText.slice(0, 4000),
        sourceType,
        sourceTag,
        promptVersion: promptContract.version,
      },
      sourceType,
      sourceTag,
      ...retryMetadata,
    },
    async () => {
      const userPrompt = `
Job Description:
"""
${rawJobText}
"""
`;

      const llmRaw = await callLLM({
        systemPrompt: promptContract.prompt,
        userPrompt,
        adapter: llmAdapter,
      });

      let parsed: RuaLLMResponse;
      try {
        parsed = JSON.parse(llmRaw) as RuaLLMResponse;
      } catch (err) {
        console.error('Failed to parse LLM JSON for RUA:', err, llmRaw);
        throw new Error('Failed to parse LLM JSON');
      }

      assertValidRuaResponse(parsed);

      const jobReq = await prisma.jobReq.create({
        data: {
          tenantId,
          title: parsed.title,
          seniorityLevel: parsed.seniorityLevel ?? null,
          location: parsed.location ?? null,
          employmentType: parsed.employmentType ?? null,
          rawDescription: rawJobText,
          status: parsed.status ?? null,
          sourceType: sourceType ?? null,
          sourceTag: sourceTag ?? null,
          skills: {
            create: parsed.skills.map((skill) => ({
              name: skill.name,
              normalizedName: skill.normalizedName || skill.name,
              required: skill.isMustHave ?? false,
            })),
          },
        },
      });

      return {
        result: { jobReqId: jobReq.id },
        outputSnapshot: parsed,
      };
    },
  );

  return { ...result, agentRunId };
}
