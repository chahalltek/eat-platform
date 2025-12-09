// src/lib/agents/outreach.ts
import { AgentRetryMetadata, withAgentRun } from '@/lib/agents/agentRun';
import { callLLM } from '@/lib/llm';
import { prisma } from '@/lib/prisma';
import { getCurrentTenantId } from '@/lib/tenant';

export type OutreachInput = {
  recruiterId?: string;
  candidateId: string;
  jobReqId: string;
};

const SYSTEM_PROMPT =
  'You are a recruiter at Strategic Systems writing a concise, friendly outreach message. Keep it brief, warm, and tailored to the candidate and role. End with a clear next step to respond or schedule a chat.';

function formatCandidateSummary({
  fullName,
  currentTitle,
  currentCompany,
  location,
  seniorityLevel,
  totalExperienceYears,
  summary,
  skills,
}: {
  fullName: string;
  currentTitle: string | null;
  currentCompany: string | null;
  location: string | null;
  seniorityLevel: string | null;
  totalExperienceYears: number | null;
  summary: string | null;
  skills: { name: string; normalizedName: string | null }[];
}): string {
  const candidateSkills = skills
    .map((skill) => skill.normalizedName || skill.name)
    .slice(0, 10)
    .join(', ');

  return [
    `Name: ${fullName}`,
    currentTitle
      ? `Current: ${currentTitle}${currentCompany ? ` at ${currentCompany}` : ''}`
      : null,
    location ? `Location: ${location}` : null,
    seniorityLevel ? `Seniority: ${seniorityLevel}` : null,
    totalExperienceYears != null ? `Experience: ${totalExperienceYears} years` : null,
    summary ? `Summary: ${summary}` : null,
    candidateSkills ? `Skills: ${candidateSkills}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatJobSummary({
  title,
  customerName,
  location,
  employmentType,
  seniorityLevel,
  status,
  rawDescription,
  skills,
}: {
  title: string;
  customerName: string | null;
  location: string | null;
  employmentType: string | null;
  seniorityLevel: string | null;
  status: string | null;
  rawDescription: string | null;
  skills: { name: string; normalizedName: string | null; required: boolean }[];
}): string {
  const jobSkills = skills
    .map((skill) => `${skill.normalizedName || skill.name}${skill.required ? ' (must-have)' : ''}`)
    .slice(0, 10)
    .join(', ');

  return [
    `Title: ${title}`,
    customerName ? `Client: ${customerName}` : null,
    location ? `Location: ${location}` : null,
    employmentType ? `Employment: ${employmentType}` : null,
    seniorityLevel ? `Seniority: ${seniorityLevel}` : null,
    status ? `Status: ${status}` : null,
    rawDescription ? `Description: ${rawDescription.slice(0, 800)}` : null,
    jobSkills ? `Key Skills: ${jobSkills}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function runOutreach(
  input: OutreachInput,
  retryMetadata?: AgentRetryMetadata,
): Promise<{ message: string; agentRunId: string }> {
  const { recruiterId, candidateId, jobReqId } = input;
  const tenantId = await getCurrentTenantId();

  const [result, agentRunId] = await withAgentRun<{ message: string }>(
    {
      agentName: 'EAT-TS.OUTREACH',
      recruiterId,
      inputSnapshot: { recruiterId: recruiterId ?? null, candidateId, jobReqId },
      ...retryMetadata,
    },
    async () => {
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId, tenantId },
        include: { skills: true },
      });

      if (!candidate) {
        throw new Error('Candidate not found');
      }

      const jobReq = await prisma.jobReq.findUnique({
        where: { id: jobReqId, tenantId },
        include: { customer: true, skills: true },
      });

      if (!jobReq) {
        throw new Error('JobReq not found');
      }

      if (candidate.tenantId !== jobReq.tenantId) {
        throw new Error('Cross-tenant outreach is not allowed');
      }

      const candidateSummary = formatCandidateSummary({
        fullName: candidate.fullName,
        currentTitle: candidate.currentTitle,
        currentCompany: candidate.currentCompany,
        location: candidate.location,
        seniorityLevel: candidate.seniorityLevel,
        totalExperienceYears: candidate.totalExperienceYears,
        summary: candidate.summary,
        skills: candidate.skills,
      });

      const jobSummary = formatJobSummary({
        title: jobReq.title,
        customerName: jobReq.customer?.name ?? null,
        location: jobReq.location,
        employmentType: jobReq.employmentType,
        seniorityLevel: jobReq.seniorityLevel,
        status: jobReq.status,
        rawDescription: jobReq.rawDescription,
        skills: jobReq.skills,
      });

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

  try {
    await prisma.outreachInteraction.create({
      data: {
        candidateId,
        jobReqId,
        tenantId,
        agentRunId,
        interactionType: "OUTREACH_GENERATED",
      },
    });
  } catch (err) {
    console.error("Failed to persist outreach interaction", err);
  }

  return { ...result, agentRunId };
}
