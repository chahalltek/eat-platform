<<<<<<< ours
import { prisma } from "../prisma";
import { computeConfidenceScore } from "../confidence/scoring";

export type RunConfidenceInput = {
  recruiterId: string; // for logging
  jobId: string;
=======
import { withAgentRun } from "@/lib/agents/agentRun";
import { AGENT_KILL_SWITCHES } from "@/lib/agents/killSwitch";
import { persistCandidateConfidenceScore } from "@/lib/candidates/confidenceScore";
import { prisma } from "@/lib/prisma";

export type RunConfidenceInput = {
  jobId: string;
  recruiterId?: string;
>>>>>>> theirs
};

export type RunConfidenceResult = {
  jobId: string;
<<<<<<< ours
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
=======
  recomputed: Array<{
    candidateId: string;
    confidence: number;
  }>;
};

export async function runConfidence({
  jobId,
  recruiterId,
}: RunConfidenceInput): Promise<RunConfidenceResult> {
  const [result] = await withAgentRun<RunConfidenceResult>(
    {
      agentName: AGENT_KILL_SWITCHES.MATCHER,
      recruiterId,
      inputSnapshot: { jobId },
      sourceType: "agent",
      sourceTag: "confidence",
    },
    async () => {
      const jobReq = await prisma.jobReq.findUnique({
        where: { id: jobId },
        include: {
          matchResults: {
            include: {
              candidate: {
                include: {
                  skills: {
                    select: {
                      id: true,
                      name: true,
                      proficiency: true,
                      yearsOfExperience: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!jobReq) {
        throw new Error(`Job ${jobId} not found`);
      }

      const recomputed: RunConfidenceResult["recomputed"] = [];

      for (const match of jobReq.matchResults) {
        const confidence = await persistCandidateConfidenceScore({
          candidateId: match.candidateId,
          candidate: match.candidate,
        });

        recomputed.push({ candidateId: match.candidateId, confidence: confidence.score });
      }

      return { result: { jobId, recomputed } };
    },
  );

  return result;
>>>>>>> theirs
}
