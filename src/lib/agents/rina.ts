// src/lib/agents/rina.ts
import { callLLM } from '@/lib/llm';
<<<<<<< ours
import { AgentRunStatus } from '@prisma/client';
=======
import { prisma } from '@/lib/prisma';
import { withAgentRun } from '@/lib/agents/agentRun';
>>>>>>> theirs

export type RinaInput = {
  recruiterId?: string;
  rawResumeText: string;
  sourceType?: string;
  sourceTag?: string;
};

type ParsedSkill = {
  name: string;
  normalizedName: string;
  proficiency?: string;
  yearsOfExperience?: number;
};

type ParsedCandidate = {
  fullName: string;
  email?: string;
  phone?: string;
  location?: string;
  currentTitle?: string;
  currentCompany?: string;
  totalExperienceYears?: number;
  seniorityLevel?: string;
  summary?: string;
  skills: ParsedSkill[];
  parsingConfidence: number;
  warnings: string[];
};

const SYSTEM_PROMPT = `
You are RINA (Resume Intake Agent) for a recruiting platform.

Your job is to read a raw resume and produce a STRICT JSON object describing the candidate.

Rules:
- Output ONLY valid JSON. No prose, no markdown.
- Do not invent contact details if they are not present.
- Be conservative with seniority and years of experience.
- Normalize skills where possible (React.js and ReactJS -> React).
- parsingConfidence should be between 0 and 1.
- warnings is an array of human-readable messages about any ambiguity.

JSON shape:
{
  "fullName": string,
  "email": string | null,
  "phone": string | null,
  "location": string | null,
  "currentTitle": string | null,
  "currentCompany": string | null,
  "totalExperienceYears": number | null,
  "seniorityLevel": string | null,
  "summary": string | null,
  "skills": [
    {
      "name": string,
      "normalizedName": string,
      "proficiency": string | null,
      "yearsOfExperience": number | null
    }
  ],
  "parsingConfidence": number,
  "warnings": string[]
}
`;

export async function runRina(
  input: RinaInput,
): Promise<{ candidateId: string; agentRunId: string }> {
  const { rawResumeText, sourceType, sourceTag } = input;
<<<<<<< ours

<<<<<<< ours
    const agentRun = await prisma.agentRunLog.create({
=======
  const startedAt = new Date();
  const startTime = startedAt.getTime();
  const inputSnapshot = {
    rawResumeText: rawResumeText.slice(0, 4000),
    sourceType,
    sourceTag,
  };

  const agentRun = await prisma.agentRunLog.create({
>>>>>>> theirs
    data: {
      agentName: 'EAT-TS.RINA',
      // Until we wire real auth, don’t link to a User row
      userId: null,
      input: inputSnapshot,
      inputSnapshot,
      status: AgentRunStatus.RUNNING,
      startedAt,
    },
  });

  let llmRaw: string | null = null;

  try {
    const userPrompt = `
=======
  const [result, agentRunId] = await withAgentRun<{ candidateId: string }>(
    {
      agentName: 'EAT-TS.RINA',
      recruiterId,
      inputSnapshot: {
        rawResumeText: rawResumeText.slice(0, 4000),
        sourceType,
        sourceTag,
      },
    },
    async () => {
      const userPrompt = `
>>>>>>> theirs
Resume:
"""
${rawResumeText}
"""
`;

<<<<<<< ours
    llmRaw = await callLLM({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
    });

    let parsed: ParsedCandidate;
    try {
      parsed = JSON.parse(llmRaw) as ParsedCandidate;
    } catch (err) {
      console.error('Failed to parse LLM JSON for RINA:', err, llmRaw);
      throw new Error('Failed to parse LLM JSON');
    }

    if (!parsed.fullName || !Array.isArray(parsed.skills)) {
      throw new Error('Parsed candidate missing required fields');
    }

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
=======
      const llmRaw = await callLLM({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
      });

      let parsed: ParsedCandidate;
      try {
        parsed = JSON.parse(llmRaw) as ParsedCandidate;
      } catch (err) {
        console.error('Failed to parse LLM JSON for RINA:', err, llmRaw);
        throw new Error('Failed to parse LLM JSON');
      }

      if (!parsed.fullName || !Array.isArray(parsed.skills)) {
        throw new Error('Parsed candidate missing required fields');
      }

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
>>>>>>> theirs
        },
      });

<<<<<<< ours
    const finishedAt = new Date();
    const updatedRun = await prisma.agentRunLog.update({
      where: { id: agentRun.id },
      data: {
        output: parsed,
        outputSnapshot: llmRaw,
        status: AgentRunStatus.SUCCESS,
        finishedAt,
        durationMs: finishedAt.getTime() - startTime,
      },
    });

    return {
      candidateId: candidate.id,
      agentRunId: updatedRun.id,
    };
<<<<<<< ours
    } catch (err) {
      await prisma.agentRunLog.update({
        where: { id: agentRun.id },
        data: {
          status: 'Failure',
          errorMessage:
            err instanceof Error ? err.message : 'Unknown error',
          finishedAt: new Date(),
        },
      });
=======
  } catch (err: unknown) {
    const finishedAt = new Date();
    const errorMessage =
      (err instanceof Error ? err.message : String(err ?? 'Unknown error')) ??
      'Unknown error';

    await prisma.agentRunLog.update({
      where: { id: agentRun.id },
      data: {
        status: AgentRunStatus.ERROR,
        errorMessage: errorMessage.slice(0, 500),
        outputSnapshot: llmRaw,
        finishedAt,
        durationMs: finishedAt.getTime() - startTime,
      },
    });
>>>>>>> theirs
=======
      return {
        result: { candidateId: candidate.id },
        outputSnapshot: parsed,
      };
    },
  );
>>>>>>> theirs

  return {
    ...result,
    agentRunId,
  };
}
