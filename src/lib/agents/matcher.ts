import { MatchResult } from "@prisma/client";

import { AgentRetryMetadata, withAgentRun } from "@/lib/agents/agentRun";
import { AGENT_KILL_SWITCHES } from "@/lib/agents/killSwitch";
import { matchJobToAllCandidates } from "@/lib/matching/batch";
<<<<<<< ours
<<<<<<< ours
import { computeMatchScore } from "@/lib/matching/msa";
import { persistCandidateConfidenceScore } from "@/lib/candidates/confidenceScore";
import { prisma } from "@/lib/prisma";
=======
>>>>>>> theirs
=======
import { computeMatchScore as computeBasicMatchScore } from "@/lib/matching/scoring";
import { prisma } from "@/lib/prisma";
import { computeConfidenceScore } from "../confidence/scoring";
>>>>>>> theirs

export const MATCHER_AGENT_NAME = AGENT_KILL_SWITCHES.MATCHER;

export type RunMatcherInput = {
  recruiterId?: string;
  jobId: string;
  topN?: number;
};

export type RunMatcherResult = {
  jobId: string;
  matches: Array<{
    id: string;
    candidateId: string;
<<<<<<< ours
    jobReqId: string;
    score: number;
=======
    matchScore: number;
    confidence: number;
    explanationId: string;
>>>>>>> theirs
  }>;
  agentRunId: string;
};

<<<<<<< ours
export async function runMatcher(
  input: RunMatcherInput,
  retryMetadata?: AgentRetryMetadata,
): Promise<RunMatcherResult> {
  const { recruiterId, jobId } = input;
  const topN = input.topN ?? 10;

  const [result, agentRunId] = await withAgentRun<RunMatcherResult>(
    {
      agentName: MATCHER_AGENT_NAME,
      recruiterId,
      inputSnapshot: { jobId, topN },
      ...retryMetadata,
    },
    async () => {
      const job = await prisma.job.findUnique({ where: { id: jobId } });

      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      const candidates = await prisma.candidate.findMany({
        where: { tenantId: job.tenantId, deletedAt: null },
      });

      const scored = candidates.map((candidate) => {
        const breakdown = computeBasicMatchScore({
          jobTitle: job.title,
          jobSkills: job.requiredSkills ?? [],
          candidateTitle: (candidate as any).primaryTitle ?? candidate.currentTitle,
          candidateSkills: candidate.normalizedSkills ?? [],
        });

        const confidence = computeConfidenceScore({
          jobSkills: job.requiredSkills ?? [],
          candidateSkills: candidate.normalizedSkills ?? [],
          hasTitle: Boolean((candidate as any).primaryTitle ?? candidate.currentTitle),
          hasLocation: Boolean(candidate.location),
          createdAt: candidate.createdAt,
        });

        return { candidate, breakdown, confidence };
      });

      const topMatches = scored
        .sort((a, b) => b.breakdown.compositeScore - a.breakdown.compositeScore)
        .slice(0, topN);

      const matches: RunMatcherResult["matches"] = [];

      for (const item of topMatches) {
        const explanation = {
          skillOverlapScore: item.breakdown.skillOverlapScore,
          titleSimilarityScore: item.breakdown.titleSimilarityScore,
        } as const;

        const matchRecord = await prisma.candidateMatch.create({
          data: {
            tenantId: job.tenantId,
            jobId: job.id,
            candidateId: item.candidate.id,
            matchScore: item.breakdown.compositeScore,
            confidence: item.confidence.total,
            explanation,
            confidenceReasons: item.confidence,
          },
        });

        const confidence = await persistCandidateConfidenceScore({
          candidateId: item.candidate.id,
          candidate: item.candidate,
        });

        matches.push({
          candidateId: item.candidate.id,
<<<<<<< ours
          matchScore: item.breakdown.score,
          confidence: confidence.score,
          explanationId: matchResult.id,
=======
          matchScore: item.breakdown.compositeScore,
          explanationId: matchRecord.id,
>>>>>>> theirs
        });
      }

      return {
        result: {
          jobId: job.id,
          matches,
          agentRunId,
        },
        outputSnapshot: {
          jobId: job.id,
          matchesCreated: matches.length,
          topN,
        },
      };
    },
  );

  return {
    ...result,
    agentRunId,
  };
}
=======
export const MATCHER_AGENT_NAME = AGENT_KILL_SWITCHES.MATCHER;
>>>>>>> theirs

export async function generateMatchExplanation(match: MatchResult): Promise<MatchResult> {
  // Placeholder for LLM-backed enrichment; kept simple for determinism in tests
  return match;
}

type MatcherAgentInput = {
  jobReqId: string;
  recruiterId?: string;
  limit?: number;
};

type MatcherAgentResult = { matches: MatchResult[] };
type MatcherAgentDependencies = { explainMatch?: typeof generateMatchExplanation };

export async function runMatcherAgent(
  { jobReqId, recruiterId, limit = 200 }: MatcherAgentInput,
  deps: MatcherAgentDependencies = {},
  retryMetadata?: AgentRetryMetadata,
): Promise<[MatcherAgentResult, string]> {
  const explainMatch = deps.explainMatch ?? generateMatchExplanation;

  return withAgentRun<MatcherAgentResult>(
    {
      agentName: MATCHER_AGENT_NAME,
      recruiterId,
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
<<<<<<< ours
=======
}

export async function runMatcher(
  input: RunMatcherInput,
  retryMetadata?: AgentRetryMetadata,
): Promise<RunMatcherResult> {
  const { recruiterId, jobId, topN } = input;

  const [result, agentRunId] = await runMatcherAgent(
    { jobReqId: jobId, recruiterId, limit: topN },
    {},
    retryMetadata,
  );

  return {
    jobId,
    agentRunId,
    matches: result.matches.map((match) => ({
      id: match.id,
      candidateId: match.candidateId,
      jobReqId: match.jobReqId,
      score: match.score,
    })),
  };
>>>>>>> theirs
}
