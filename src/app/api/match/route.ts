import { NextResponse } from "next/server";

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
    include: { skills: true },
  });

  if (!jobReq) {
    return NextResponse.json({ error: "JobReq not found" }, { status: 404 });
  }

  const matchScore = computeMatchScore({ candidate, jobReq });

  const data = {
    candidateId,
    jobReqId,
    score: matchScore.score,
    reasons: matchScore.reasons,
    skillScore: matchScore.skillScore,
    seniorityScore: matchScore.seniorityScore,
    locationScore: matchScore.locationScore,
  };

  const existingMatch = await prisma.matchResult.findFirst({
    where: { candidateId, jobReqId },
  });

<<<<<<< ours
=======
  const matchResult = existingMatch
    ? await prisma.matchResult.update({
        where: { id: existingMatch.id },
        data,
      })
    : await prisma.matchResult.create({ data });

>>>>>>> theirs
  await upsertJobCandidateForMatch(jobReqId, candidateId, matchResult.id);

  return NextResponse.json(matchResult);
}
