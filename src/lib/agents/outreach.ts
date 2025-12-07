// src/lib/agents/outreach.ts
import { withAgentRun } from '@/lib/agents/agentRun';
import { callLLM } from '@/lib/llm';
import { prisma } from '@/lib/prisma';

export type OutreachInput = {
  recruiterId?: string;
  candidateId: string;
  jobReqId: string;
};

const SYSTEM_PROMPT =
  'You are a recruiter at Strategic Systems writing a concise, friendly outreach message. Keep it brief, warm, and tailored to the candidate and role. End with a clear next step to respond or schedule a chat.';

export async function runOutreach(
  input: OutreachInput,
): Promise<{ message: string; agentRunId: string }> {
  const { recruiterId, candidateId, jobReqId } = input;

  const [result, agentRunId] = await withAgentRun<{ message: string }>(
    {
      agentName: 'EAT-TS.OUTREACH',
      recruiterId,
      inputSnapshot: { recruiterId: recruiterId ?? null, candidateId, jobReqId },
    },
    async () => {
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        include: { skills: true },
      });

      if (!candidate) {
        throw new Error('Candidate not found');
      }

      const jobReq = await prisma.jobReq.findUnique({
        where: { id: jobReqId },
        include: { customer: true, skills: true },
      });

      if (!jobReq) {
        throw new Error('JobReq not found');
      }

      const candidateSkills = candidate.skills
        .map((skill) => skill.normalizedName || skill.name)
        .slice(0, 10)
        .join(', ');

      const candidateSummary = [
        `Name: ${candidate.fullName}`,
        candidate.currentTitle
          ? `Current: ${candidate.currentTitle}${candidate.currentCompany ? ` at ${candidate.currentCompany}` : ''}`
          : null,
        candidate.location ? `Location: ${candidate.location}` : null,
        candidate.seniorityLevel ? `Seniority: ${candidate.seniorityLevel}` : null,
        candidate.totalExperienceYears != null
          ? `Experience: ${candidate.totalExperienceYears} years`
          : null,
        candidate.summary ? `Summary: ${candidate.summary}` : null,
        candidateSkills ? `Skills: ${candidateSkills}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      const jobSkills = jobReq.skills
        .map((skill) => `${skill.normalizedName || skill.name}${skill.required ? ' (must-have)' : ''}`)
        .slice(0, 10)
        .join(', ');

      const jobSummary = [
        `Title: ${jobReq.title}`,
        jobReq.customer?.name ? `Client: ${jobReq.customer.name}` : null,
        jobReq.location ? `Location: ${jobReq.location}` : null,
        jobReq.employmentType ? `Employment: ${jobReq.employmentType}` : null,
        jobReq.seniorityLevel ? `Seniority: ${jobReq.seniorityLevel}` : null,
        jobReq.status ? `Status: ${jobReq.status}` : null,
        jobReq.rawDescription ? `Description: ${jobReq.rawDescription.slice(0, 800)}` : null,
        jobSkills ? `Key Skills: ${jobSkills}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      const userPrompt = `Candidate profile:\n${candidateSummary}\n\nRole details:\n${jobSummary}\n\nWrite a short outreach message introducing the opportunity and why it fits ${candidate.fullName}. Keep it under 120 words and end with an invitation to reply or schedule time.`;

      const message = await callLLM({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
      });

      return {
        result: { message },
        outputSnapshot: { candidateId, jobReqId, message },
      };
    },
  );

  return { ...result, agentRunId };
}
