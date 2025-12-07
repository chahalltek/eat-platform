import { NextResponse } from "next/server";

import { JobCandidateStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { jobCandidateId, status } = (body ?? {}) as {
    jobCandidateId?: string;
    status?: string;
  };

  if (!jobCandidateId || !status) {
    return NextResponse.json({ error: "jobCandidateId and status are required" }, { status: 400 });
  }

  const parsedStatus = status as JobCandidateStatus;
  const validStatuses = new Set(Object.values(JobCandidateStatus));

  if (!validStatuses.has(parsedStatus)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
  }

  const jobCandidate = await prisma.jobCandidate.findUnique({
    where: { id: jobCandidateId },
  });

  if (!jobCandidate) {
    return NextResponse.json({ error: "JobCandidate not found" }, { status: 404 });
  }

  const updatedJobCandidate = await prisma.jobCandidate.update({
    where: { id: jobCandidateId },
    data: { status: parsedStatus },
  });

  return NextResponse.json(updatedJobCandidate);
}
