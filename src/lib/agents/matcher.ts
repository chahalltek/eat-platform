import { MatchResult } from "@prisma/client";

import { AgentRetryMetadata, withAgentRun } from "@/lib/agents/agentRun";
import { AGENT_KILL_SWITCHES } from "@/lib/agents/killSwitch";
import { persistCandidateConfidenceScore } from "@/lib/candidates/confidenceScore";
import { matchJobToAllCandidates } from "@/lib/matching/batch";
import { getCurrentUser } from "@/lib/auth";

export const MATCHER_AGENT_NAME = AGENT_KILL_SWITCHES.MATCHER;

export type RunMatcherInput = {
  recruiterId?: string;
  jobId: string;
  topN?: number;
};

export type RunMatcherResult = {
  jobId: string;
  matches: Array<{
    candidateId: string;
    jobReqId: string;
    matchScore: number;
    confidence: number;
    explanationId: string;
  }>;
  agentRunId: string;
};

type MatcherAgentInput = { jobReqId: string; recruiterId?: string; limit?: number };
type MatcherAgentResult = { matches: MatchResult[] };
type MatcherAgentDependencies = { explainMatch?: typeof generateMatchExplanation };

export async function generateMatchExplanation(match: MatchResult): Promise<MatchResult> {
  // Placeholder for LLM-backed enrichment; kept simple for determinism in tests
  return match;
}

export async function runMatcherAgent(
  { jobReqId, recruiterId: _recruiterId, limit = 200 }: MatcherAgentInput,
  deps: MatcherAgentDependencies = {},
  retryMetadata?: AgentRetryMetadata,
): Promise<[MatcherAgentResult, string]> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Current user is required to run matcher agent");
  }

  // User identity is derived from auth; recruiterId in payload is ignored.
  const explainMatch = deps.explainMatch ?? generateMatchExplanation;

  return withAgentRun<MatcherAgentResult>(
    {
      agentName: MATCHER_AGENT_NAME,
      recruiterId: user.id,
      inputSnapshot: { jobReqId, limit },
      sourceType: "agent",
      sourceTag: "matcher",
      ...retryMetadata,
    },
    async () => {
      const matches = await matchJobToAllCandidates(jobReqId, limit);
      const enrichedMatches = await Promise.all(matches.map((match) => explainMatch(match)));

      const sortedMatches = [...enrichedMatches].sort((a, b) => b.score - a.score);

      return { result: { matches: sortedMatches } };
    },
  );
}

export async function runMatcher(
  input: RunMatcherInput,
  retryMetadata?: AgentRetryMetadata,
): Promise<RunMatcherResult> {
  const { jobId, topN } = input;

  const [result, agentRunId] = await runMatcherAgent(
    { jobReqId: jobId, limit: topN },
    {},
    retryMetadata,
  );

  const matchesWithConfidence = await Promise.all(
    result.matches.map(async (match) => {
      const confidence = await persistCandidateConfidenceScore({ candidateId: match.candidateId });

      return {
        candidateId: match.candidateId,
        jobReqId: match.jobReqId,
        matchScore: match.score,
        confidence: confidence.score,
        explanationId: match.id,
      };
    }),
  );

  return {
    jobId,
    agentRunId,
    matches: matchesWithConfidence,
  };
}
