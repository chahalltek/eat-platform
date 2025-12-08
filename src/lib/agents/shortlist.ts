<<<<<<< ours
import { prisma } from '../prisma';

export type RunShortlistInput = {
  recruiterId: string;
  jobId: string;
  minMatchScore?: number;
  minConfidence?: number;
  maxShortlisted?: number;
=======
import { AgentRetryMetadata, withAgentRun } from "@/lib/agents/agentRun";
import { AGENT_KILL_SWITCHES } from "@/lib/agents/killSwitch";
import { rankCandidates } from "@/lib/agents/ranker";
import { prisma } from "@/lib/prisma";

export type RunShortlistInput = {
  jobId: string;
  recruiterId?: string;
  shortlistLimit?: number;
>>>>>>> theirs
};

export type RunShortlistResult = {
  jobId: string;
<<<<<<< ours
  shortlistedIds: string[];
  clearedCount: number;
  agentRunId: string;
};

type RankedMatch = {
  id: string;
  candidateName: string;
  matchScore: number;
  confidence: number;
  rankScore: number;
};

function computeRankScore(matchScore: number, confidence: number): number {
  // Simple linear combo; easy to tune later
  return matchScore * 0.7 + confidence * 0.3;
}

export async function runShortlist(
  input: RunShortlistInput
): Promise<RunShortlistResult> {
  const {
    recruiterId,
    jobId,
    minMatchScore = 60,
    minConfidence = 50,
    maxShortlisted = 5,
  } = input;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      matches: {
        include: { candidate: true },
      },
    },
  });

  if (!job) {
    throw new Error(`Job ${jobId} not found for SHORTLIST agent`);
  }

  const agentRun = await prisma.agentRunLog.create({
    data: {
      agentName: 'EAT-TS.SHORTLIST',
      userId: recruiterId ?? null,
      inputSummary: `jobId=${jobId}, matches=${job.matches.length}, thresholds: match>=${minMatchScore}, conf>=${minConfidence}, max=${maxShortlisted}`,
      status: 'RUNNING',
    },
  });

  try {
    const eligible: RankedMatch[] = job.matches
      .filter(
        (m) => m.matchScore >= minMatchScore && m.confidence >= minConfidence
      )
      .map((m) => ({
        id: m.id,
        candidateName: m.candidate.fullName,
        matchScore: m.matchScore,
        confidence: m.confidence,
        rankScore: computeRankScore(m.matchScore, m.confidence),
      }))
      .sort((a, b) => b.rankScore - a.rankScore);

    const shortlist = eligible.slice(0, maxShortlisted);
    const shortlistedIds = new Set(shortlist.map((m) => m.id));

    // Clear all shortlist flags for this job first
    const cleared = await prisma.candidateMatch.updateMany({
      where: { jobId },
      data: {
        shortlisted: false,
        shortlistReason: null,
      },
    });

    // Mark shortlisted ones
    for (const m of shortlist) {
      await prisma.candidateMatch.update({
        where: { id: m.id },
        data: {
          shortlisted: true,
          shortlistReason: `Shortlisted by EAT-TS.SHORTLIST (matchScore=${m.matchScore}, confidence=${m.confidence}, rankScore=${Math.round(
            m.rankScore
          )})`,
        },
      });
    }

    await prisma.agentRunLog.update({
      where: { id: agentRun.id },
      data: {
        status: 'SUCCESS',
        outputSummary: `Shortlisted ${shortlist.length} matches; cleared ${cleared.count} for job ${jobId}`,
      },
    });

    return {
      jobId,
      shortlistedIds: Array.from(shortlistedIds),
      clearedCount: cleared.count,
      agentRunId: agentRun.id,
    };
  } catch (err) {
    await prisma.agentRunLog.update({
      where: { id: agentRun.id },
      data: {
        status: 'FAILED',
        errorMessage: (err as Error).message,
      },
    });
    throw err;
  }
=======
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

  const overlapCount = normalizedJobSkills.filter((skill) => normalizedCandidateSkills.has(skill)).length;
  const coverage = overlapCount / normalizedJobSkills.length;

  return clampScore(coverage * 100);
}

function buildShortlistReason(priorityScore: number, recencyScore: number, rank: number) {
  return `#${rank} candidate — priority ${priorityScore}, recency ${recencyScore}`;
}

export async function runShortlist(
  { jobId, recruiterId, shortlistLimit = 5 }: RunShortlistInput,
  deps: ShortlistDependencies = {},
  retryMetadata?: AgentRetryMetadata,
): Promise<RunShortlistResult & { agentRunId: string }> {
  const clock = deps.now ?? (() => new Date());

  const [result, agentRunId] = await withAgentRun<RunShortlistResult>(
    {
      agentName: AGENT_KILL_SWITCHES.RANKER,
      recruiterId,
      inputSnapshot: { jobId, shortlistLimit },
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
        return { result: { jobId, shortlisted: [], totalMatches: 0 } };
      }

      const now = clock();

      const rankerInputs = job.matches.map((match) => ({
        id: match.id,
        matchScore: clampScore(match.matchScore),
        confidenceScore: clampScore(match.confidence),
        recencyDays: computeRecencyDays(now, match.candidate.updatedAt, match.candidate.createdAt),
        roleAlignment: computeRoleAlignment(job.requiredSkills ?? [], match.candidate.normalizedSkills ?? []),
      }));

      const ranked = rankCandidates(rankerInputs);
      const shortlist = ranked.slice(0, shortlistLimit);
      const matchesById = new Map(job.matches.map((match) => [match.id, match]));

      const shortlisted = shortlist.map((candidate, index) => {
        const match = matchesById.get(candidate.id)!;
        const rank = index + 1;
        const shortlistReason = buildShortlistReason(candidate.priorityScore, candidate.recencyScore, rank);

        return {
          matchId: match.id,
          candidateId: match.candidateId,
          priorityScore: candidate.priorityScore,
          recencyScore: candidate.recencyScore,
          shortlistReason,
        };
      });

      await prisma.$transaction(async (tx) => {
        await tx.candidateMatch.updateMany({
          where: { jobId },
          data: { shortlisted: false, shortlistReason: null },
        });

        for (const entry of shortlisted) {
          await tx.candidateMatch.update({
            where: { id: entry.matchId },
            data: { shortlisted: true, shortlistReason: entry.shortlistReason },
          });
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
>>>>>>> theirs
}
