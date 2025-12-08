import { prisma } from "../prisma";
import { computeConfidenceScore } from "../confidence/scoring";

export type RunConfidenceInput = {
  recruiterId: string; // for logging
  jobId: string;
};

export type RunConfidenceResult = {
  jobId: string;
  updatedCount: number;
  agentRunId: string;
};

export async function runConfidence(
  input: RunConfidenceInput,
): Promise<RunConfidenceResult> {
  const { recruiterId, jobId } = input;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      matches: {
        include: { candidate: true },
      },
    },
  });

  if (!job) {
    throw new Error(`Job ${jobId} not found for CONFIDENCE agent`);
  }

  // Log the agent run
  const agentRun = await prisma.agentRunLog.create({
    data: {
      agentName: "EAT-TS.CONFIDENCE",
      userId: recruiterId ?? null,
      inputSummary: `jobId=${jobId}, matchCount=${job.matches.length}`,
      status: "RUNNING",
    },
  });

  try {
    let updatedCount = 0;

    for (const match of job.matches) {
      const candidate = match.candidate;

      const breakdown = computeConfidenceScore({
        jobSkills: job.requiredSkills ?? [],
        candidateSkills: candidate.normalizedSkills ?? [],
        hasTitle: !!candidate.primaryTitle,
        hasLocation: !!candidate.location,
        createdAt: candidate.createdAt,
      });

      await prisma.candidateMatch.update({
        where: { id: match.id },
        data: {
          confidence: breakdown.total,
          confidenceReasons: breakdown,
        },
      });

      updatedCount++;
    }

    await prisma.agentRunLog.update({
      where: { id: agentRun.id },
      data: {
        status: "SUCCESS",
        outputSummary: `Updated confidence for ${updatedCount} matches on job ${jobId}`,
      },
    });

    return {
      jobId,
      updatedCount,
      agentRunId: agentRun.id,
    };
  } catch (err) {
    await prisma.agentRunLog.update({
      where: { id: agentRun.id },
      data: {
        status: "FAILED",
        errorMessage: (err as Error).message,
      },
    });
    throw err;
  }
}
