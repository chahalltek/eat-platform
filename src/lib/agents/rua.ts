// src/lib/agents/rua.ts
import { AgentRetryMetadata, withAgentRun } from '@/lib/agents/agentRun';
import { callLLM } from '@/lib/llm';
import { prisma } from '@/lib/prisma';

export type RuaInput = {
  recruiterId?: string;
  rawJobText: string;
  sourceType?: string;
  sourceTag?: string;
};

type ParsedJobSkill = {
  name: string;
  normalizedName?: string;
  isMustHave?: boolean;
};

type ParsedJobReq = {
  clientName?: string;
  title: string;
  seniorityLevel?: string;
  location?: string;
  remoteType?: string;
  employmentType?: string;
  responsibilitiesSummary?: string;
  teamContext?: string;
  priority?: string;
  status?: string;
  ambiguityScore?: number;
  skills: ParsedJobSkill[];
};

const SYSTEM_PROMPT = `
You are RUA (Role Understanding Agent) for a recruiting platform.

Your job is to read a raw job description and produce a STRICT JSON object describing the job requirements.

Rules:
- Output ONLY valid JSON. No prose, no markdown.
- Be conservative with seniority and requirements.
- Normalize skills where possible (React.js and ReactJS -> React).
- ambiguityScore should be between 0 and 1 reflecting how unclear the description is.

JSON shape:
{
  "clientName": string | null,
  "title": string,
  "seniorityLevel": string | null,
  "location": string | null,
  "remoteType": string | null,
  "employmentType": string | null,
  "responsibilitiesSummary": string | null,
  "teamContext": string | null,
  "priority": string | null,
  "status": string | null,
  "ambiguityScore": number | null,
  "skills": [
    {
      "name": string,
      "normalizedName": string,
      "isMustHave": boolean
    }
  ]
}`;

export async function runRua(
  input: RuaInput,
  retryMetadata?: AgentRetryMetadata,
): Promise<{ jobReqId: string; agentRunId: string }> {
  const { recruiterId, rawJobText, sourceType, sourceTag } = input;

  const [result, agentRunId] = await withAgentRun<{ jobReqId: string }>(
    {
      agentName: 'EAT-TS.RUA',
      recruiterId,
      inputSnapshot: {
        recruiterId: recruiterId ?? null,
        rawJobText: rawJobText.slice(0, 4000),
        sourceType,
        sourceTag,
      },
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
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
      });

      let parsed: ParsedJobReq;
      try {
        parsed = JSON.parse(llmRaw) as ParsedJobReq;
      } catch (err) {
        console.error('Failed to parse LLM JSON for RUA:', err, llmRaw);
        throw new Error('Failed to parse LLM JSON');
      }

      if (!parsed.title || !Array.isArray(parsed.skills)) {
        throw new Error('Parsed job req missing required fields');
      }

      const jobReq = await prisma.jobReq.create({
        data: {
          title: parsed.title,
          seniorityLevel: parsed.seniorityLevel ?? null,
          location: parsed.location ?? null,
          employmentType: parsed.employmentType ?? null,
          rawDescription: rawJobText,
          status: parsed.status ?? null,
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
