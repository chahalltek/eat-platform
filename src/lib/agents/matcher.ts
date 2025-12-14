import { MatchResult } from "@/server/db";

import { AgentRetryMetadata, withAgentRun } from "@/lib/agents/agentRun";
import { AGENT_KILL_SWITCHES } from "@/lib/agents/killSwitch";
import { matchJobToAllCandidates } from "@/lib/matching/batch";
import { getCurrentUser } from "@/lib/auth";
import { MatchConfidence } from "@/lib/matching/confidence";
import { loadTenantConfig } from "@/lib/config/tenantConfig";
import { TS_CONFIG } from "@/config/ts";

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
    confidenceCategory: string;
    confidenceReasons: string[];
    explanationId: string;
  }>;
  agentRunId: string;
};

type MatcherAgentInput = { jobReqId: string; recruiterId?: string; limit?: number };
type MatcherAgentResult = { matches: MatchResult[] };
type MatcherAgentDependencies = { explainMatch?: typeof generateMatchExplanation };

function extractConfidenceFromBreakdown(breakdown: unknown): MatchConfidence | null {
  if (typeof breakdown !== "object" || breakdown === null) {
    return null;
  }

  const confidence = (breakdown as Record<string, unknown>).confidence as
    | MatchConfidence
    | undefined;

  if (
    !confidence ||
    typeof confidence.score !== "number" ||
    typeof confidence.category !== "string" ||
    !Array.isArray(confidence.reasons)
  ) {
    return null;
  }

  return confidence;
}

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
      const tenantId = matches[0]?.tenantId ?? null;
      const tenantConfig = await loadTenantConfig(tenantId);
      const minScore =
        tenantConfig.scoring?.matcher?.minScore ??
        tenantConfig.matcher?.minScore ??
        TS_CONFIG.scoring.matcher.minScore;
      const enrichedMatches = await Promise.all(matches.map((match) => explainMatch(match)));

      const filteredMatches = enrichedMatches.filter((match) => match.score >= minScore);

      const sortedMatches = [...filteredMatches].sort((a, b) => b.score - a.score);

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

  const matchesWithConfidence = result.matches.map((match) => {
    const confidence = extractConfidenceFromBreakdown(match.candidateSignalBreakdown) ?? {
      score: 0,
      category: "LOW",
      reasons: [],
      breakdown: { dataCompleteness: 0, skillCoverage: 0, recency: 0, total: 0 },
    };

    return {
      candidateId: match.candidateId,
      jobReqId: match.jobReqId,
      matchScore: match.score,
      confidence: confidence.score,
      confidenceCategory: confidence.category,
      confidenceReasons: confidence.reasons,
      explanationId: match.id,
    };
  });

  return {
    jobId,
    agentRunId,
    matches: matchesWithConfidence,
  };
}
