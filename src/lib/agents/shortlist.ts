import { AgentRetryMetadata, withAgentRun } from "@/lib/agents/agentRun";
import { AGENT_KILL_SWITCHES } from "@/lib/agents/killSwitch";
import { rankCandidates } from "@/lib/agents/ranker";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setShortlistState } from "@/lib/matching/shortlist";
import { loadTenantConfig } from "@/lib/config/tenantConfig";

export type RunShortlistInput = {
  jobId: string;
  recruiterId?: string;
  shortlistLimit?: number;
};

export type RunShortlistResult = {
  jobId: string;
  shortlisted: Array<{
    matchId: string;
    candidateId: string;
    priorityScore: number;
    recencyScore: number;
    shortlistReason: string;
  }>;
  totalMatches: number;
};

type ShortlistDependencies = {
  now?: () => Date;
};

type ShortlistGuardrails = {
  shortlistMinScore?: number;
  shortlistMinConfidence?: number;
  shortlistMaxCandidates?: number;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function computeRecencyDays(now: Date, updatedAt: Date, createdAt: Date) {
  const referenceDate = updatedAt ?? createdAt;
  const diffMs = now.getTime() - referenceDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

function computeRoleAlignment(jobSkills: string[], candidateSkills: string[]) {
  const normalizedJobSkills = jobSkills.map((skill) => skill.toLowerCase());
  const normalizedCandidateSkills = new Set(candidateSkills.map((skill) => skill.toLowerCase()));

  if (normalizedJobSkills.length === 0 || normalizedCandidateSkills.size === 0) {
    return 50;
  }

  const overlapCount = normalizedJobSkills.filter((skill) =>
    normalizedCandidateSkills.has(skill),
  ).length;
  const coverage = overlapCount / normalizedJobSkills.length;

  return clampScore(coverage * 100);
}

function buildShortlistReason(priorityScore: number, recencyScore: number, rank: number) {
  return `#${rank} candidate — priority ${priorityScore}, recency ${recencyScore}`;
}

export async function runShortlist(
  { jobId, recruiterId: _recruiterId, shortlistLimit }: RunShortlistInput,
  deps: ShortlistDependencies = {},
  guardrails?: ShortlistGuardrails,
  retryMetadata?: AgentRetryMetadata,
): Promise<RunShortlistResult & { agentRunId: string }> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Current user is required to run shortlist agent");
  }

  // User identity is derived from auth; recruiterId in payload is ignored.
  const clock = deps.now ?? (() => new Date());
<<<<<<< ours
  const requestedShortlistLimit = shortlistLimit;
=======
  const { shortlist } = TS_CONFIG;
  const effectiveShortlistLimit = guardrails?.shortlistMaxCandidates ?? shortlistLimit ?? shortlist.topN;
  const minMatchScore = guardrails?.shortlistMinScore ?? shortlist.minMatchScore;
  const minConfidence = guardrails?.shortlistMinConfidence ?? shortlist.minConfidence;
>>>>>>> theirs

  const [result, agentRunId] = await withAgentRun<RunShortlistResult>(
    {
      agentName: AGENT_KILL_SWITCHES.RANKER,
      recruiterId: user.id,
      inputSnapshot: { jobId, shortlistLimit: requestedShortlistLimit ?? null },
      sourceType: "agent",
      sourceTag: "shortlist",
      ...retryMetadata,
    },
    async () => {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          matches: {
            include: {
              candidate: true,
            },
          },
        },
      });

      if (!job) {
        throw new Error(`Job ${jobId} not found for shortlist agent`);
      }

      if (job.matches.length === 0) {
        return { result: { jobId, shortlisted: [], totalMatches: 0 }, outputSnapshot: { shortlisted: [], rankedOrder: [] } };
      }

      const tenantConfig = await loadTenantConfig(job.tenantId);
      const shortlistConfig = tenantConfig.shortlist;
      const effectiveShortlistLimit = requestedShortlistLimit ?? shortlistConfig.topN;

      const eligibleMatches = job.matches.filter((match) => {
        const matchScore = clampScore(match.matchScore);
        const confidenceScore = clampScore(match.confidence);

<<<<<<< ours
        return (
          matchScore >= shortlistConfig.minMatchScore &&
          confidenceScore >= shortlistConfig.minConfidence
        );
=======
        return matchScore >= minMatchScore && confidenceScore >= minConfidence;
>>>>>>> theirs
      });

      const now = clock();

      const rankerInputs = eligibleMatches.map((match) => ({
        id: match.id,
        matchScore: clampScore(match.matchScore),
        confidenceScore: clampScore(match.confidence),
        recencyDays: computeRecencyDays(now, match.candidate.updatedAt, match.candidate.createdAt),
        roleAlignment: computeRoleAlignment(
          job.requiredSkills ?? [],
          match.candidate.normalizedSkills ?? [],
        ),
      }));

      const ranked = rankCandidates(rankerInputs);
      const shortlistResults = ranked.slice(0, effectiveShortlistLimit);
      const matchesById = new Map(eligibleMatches.map((match) => [match.id, match]));

      const shortlisted = shortlistResults.map((candidate, index) => {
        const match = matchesById.get(candidate.id)!;
        const rank = index + 1;
        const shortlistReason = buildShortlistReason(
          candidate.priorityScore,
          candidate.recencyScore,
          rank,
        );

        return {
          matchId: match.id,
          candidateId: match.candidateId,
          priorityScore: candidate.priorityScore,
          recencyScore: candidate.recencyScore,
          shortlistReason,
        };
      });

      const shortlistedByMatchId = new Map(shortlisted.map((entry) => [entry.matchId, entry]));

      await prisma.$transaction(async (tx) => {
        for (const match of job.matches) {
          const shortlistEntry = shortlistedByMatchId.get(match.id);
          await setShortlistState(
            job.id,
            match.candidateId,
            Boolean(shortlistEntry),
            shortlistEntry?.shortlistReason,
            { db: tx, tenantId: job.tenantId },
          );
        }
      });

      return {
        result: {
          jobId,
          shortlisted,
          totalMatches: job.matches.length,
        },
        outputSnapshot: {
          shortlisted,
          rankedOrder: ranked.map((candidate) => candidate.id),
        },
      };
    },
  );

  return { ...result, agentRunId };
}
