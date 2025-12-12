import { callLLM } from '../llm';

export type ExplanationInput = {
  jobTitle: string;
  jobDescription: string;
  jobSkills: string[];
  candidateName: string;
  candidateTitle?: string | null;
  candidateSkills: string[];
  matchScore: number;
};

export type ExplanationOutput = {
  summary: string; // short “why this candidate”
  strengths: string[]; // bullets
  gaps: string[]; // bullets
  recommendedAction: string; // “reach out now”, “keep warm”, etc.
};

export async function generateMatchExplanation(
  input: ExplanationInput
): Promise<ExplanationOutput> {
  const systemPrompt = `
You are an expert technical recruiter. You explain candidate-job fit clearly and concisely.
Return JSON only with keys: summary, strengths, gaps, recommendedAction.
`;

  const userPrompt = `
JOB:
- Title: ${input.jobTitle}
- Required skills: ${input.jobSkills.join(', ')}

CANDIDATE:
- Name: ${input.candidateName}
- Title: ${input.candidateTitle ?? 'N/A'}
- Skills: ${input.candidateSkills.join(', ')}

MATCH SCORE: ${input.matchScore} (0-100)

Explain why this candidate received this score. Be honest about both strengths and gaps.
`;

  const raw = await callLLM({
    model: 'gpt-4.1-mini',
    systemPrompt,
    userPrompt,
    agent: 'MATCH_EXPLAIN',
  });

  // MVP: assume the model returns valid JSON; we can harden later
  try {
    return JSON.parse(raw) as ExplanationOutput;
  } catch {
    return {
      summary: raw.slice(0, 280),
      strengths: [],
      gaps: [],
      recommendedAction: 'review manually',
    };
  }
}
