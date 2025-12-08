import { prisma } from '../prisma';

export type RunShortlistInput = {
  recruiterId: string;
  jobId: string;
  minMatchScore?: number;
  minConfidence?: number;
  maxShortlisted?: number;
};

export type RunShortlistResult = {
  jobId: string;
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
}
