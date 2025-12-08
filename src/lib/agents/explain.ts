import { getCurrentUser } from '@/lib/auth';
import { prisma } from '../prisma';
import { callLLM } from '../llm';
import { createAgentRunLog } from './agentRunLog';

export type RunExplainInput = {
  recruiterId?: string;
  jobId: string;
  maxMatches?: number; // limit per run
};

export type RunExplainResult = {
  jobId: string;
  processedCount: number;
  agentRunId: string;
};

function buildExplainPrompt(params: {
  jobTitle: string;
  jobDescription?: string | null;
  jobSkills: string[];
  candidateName: string;
  candidateTitle?: string | null;
  candidateLocation?: string | null;
  candidateSkills: string[];
}) {
  const { jobTitle, jobDescription, jobSkills, candidateName, candidateTitle, candidateLocation, candidateSkills } =
    params;

  return `
You are an expert technical recruiter.

Explain why this candidate is a good or poor fit for the role in a short, recruiter-friendly way.

Be specific about skills, seniority, and any concerns. Keep it under 120 words.

Role:
- Title: ${jobTitle}
- Key skills: ${jobSkills.join(', ') || 'n/a'}
- Description: ${jobDescription || '(no detailed description)'}

Candidate:
- Name: ${candidateName}
- Title: ${candidateTitle || '(no title)'}
- Location: ${candidateLocation || '(no location)'}
- Skills: ${candidateSkills.join(', ') || 'n/a'}

Write your answer as a short paragraph.
`;
}

function extractSummary(text: string): string {
  const trimmed = text.trim();
  const firstSentenceEnd = trimmed.indexOf('. ');
  if (firstSentenceEnd === -1) {
    return trimmed.slice(0, 160);
  }
  return trimmed.slice(0, Math.min(firstSentenceEnd + 1, 200));
}

export async function runExplainForJob(input: RunExplainInput): Promise<RunExplainResult> {
  const { jobId, maxMatches = 20 } = input;
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Current user is required to run explain agent');
  }

  // User identity is derived from auth; recruiterId in payload is ignored.

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      matches: {
        include: { candidate: true },
        orderBy: { matchScore: 'desc' },
      },
    },
  });

  if (!job) {
    throw new Error(`Job ${jobId} not found for EXPLAIN agent`);
  }

  const matchesNeedingExplain = job.matches.filter((m) => {
    const explanation: any = m.explanation;
    return !explanation || !explanation.summary;
  });

  const toProcess = matchesNeedingExplain.slice(0, maxMatches);
  const runInput = { jobId, toProcess: toProcess.length };

  const agentRun = await createAgentRunLog(prisma, {
    agentName: 'EAT-TS.EXPLAIN',
    input: runInput,
    inputSnapshot: runInput,
    status: 'RUNNING',
  });

  let processedCount = 0;

  try {
    for (const match of toProcess) {
      const candidate = match.candidate;

      const userPrompt = buildExplainPrompt({
        jobTitle: job.title,
        jobDescription: job.description,
        jobSkills: job.requiredSkills ?? [],
        candidateName: candidate.fullName,
        candidateTitle: candidate.currentTitle,
        candidateLocation: candidate.location,
        candidateSkills: candidate.normalizedSkills ?? [],
      });

      const explanationText = await callLLM({
        model: 'gpt-4.1-mini',
        systemPrompt: 'You are an expert recruiter explaining candidate-to-role fit clearly and concisely.',
        userPrompt,
      });

      const summary = extractSummary(explanationText);

      await prisma.candidateMatch.update({
        where: { id: match.id },
        data: {
          explanation: {
            summary,
            markdown: explanationText,
          },
        },
      });

      processedCount += 1;
    }

    await prisma.agentRunLog.update({
      where: { id: agentRun.id },
      data: {
        status: 'SUCCESS',
        output: { snapshot: { processedCount } },
        outputSnapshot: { processedCount },
      },
    });
  } catch (err) {
    await prisma.agentRunLog.update({
      where: { id: agentRun.id },
      data: {
        status: 'ERROR',
        output: { snapshot: { error: (err as Error)?.message ?? 'unknown error' } },
        outputSnapshot: { error: (err as Error)?.message ?? 'unknown error' },
      },
    });
    throw err;
  }

  return { jobId, processedCount, agentRunId: agentRun.id };
}
