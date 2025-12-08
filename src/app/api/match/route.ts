import { NextResponse } from "next/server";

<<<<<<< ours
import { computeJobFreshnessScore } from "@/lib/matching/freshness";
=======
import { computeCandidateSignalScore } from "@/lib/matching/candidateSignals";
>>>>>>> theirs
import { computeMatchScore } from "@/lib/matching/msa";
import { upsertJobCandidateForMatch } from "@/lib/matching/jobCandidate";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { jobReqId, candidateId } = (body ?? {}) as {
    jobReqId?: string;
    candidateId?: string;
  };

  if (!jobReqId || !candidateId) {
    return NextResponse.json({ error: "jobReqId and candidateId are required" }, { status: 400 });
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: { skills: true },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const jobReq = await prisma.jobReq.findUnique({
    where: { id: jobReqId },
    include: {
      skills: true,
      matchResults: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!jobReq) {
    return NextResponse.json({ error: "JobReq not found" }, { status: 404 });
  }

<<<<<<< ours
  const latestMatchActivity = jobReq.matchResults[0]?.createdAt ?? null;
  const freshnessScore = computeJobFreshnessScore({
    createdAt: jobReq.createdAt,
    updatedAt: jobReq.updatedAt,
    latestMatchActivity,
  });

  const matchScore = computeMatchScore(
    { candidate, jobReq },
    { jobFreshnessScore: freshnessScore.score },
  );
=======
  const jobCandidate = await prisma.jobCandidate.findUnique({
    where: { jobReqId_candidateId: { jobReqId, candidateId } },
  });

  const outreachInteractions = await prisma.outreachInteraction.count({
    where: { jobReqId, candidateId },
  });

  const candidateSignals = computeCandidateSignalScore({
    candidate,
    jobCandidate,
    outreachInteractions,
  });

  const matchScore = computeMatchScore({ candidate, jobReq }, candidateSignals);
>>>>>>> theirs

  const data = {
    candidateId,
    jobReqId,
    score: matchScore.score,
    reasons: matchScore.reasons,
    skillScore: matchScore.skillScore,
    seniorityScore: matchScore.seniorityScore,
    locationScore: matchScore.locationScore,
    candidateSignalScore: matchScore.candidateSignalScore,
    candidateSignalBreakdown: matchScore.candidateSignalBreakdown,
  };

  const existingMatch = await prisma.matchResult.findFirst({
    where: { candidateId, jobReqId },
  });

  const matchResult = existingMatch
    ? await prisma.matchResult.update({
        where: { id: existingMatch.id },
        data,
      })
    : await prisma.matchResult.create({ data });

  await upsertJobCandidateForMatch(jobReqId, candidateId, matchResult.id);

  return NextResponse.json(matchResult);
}
