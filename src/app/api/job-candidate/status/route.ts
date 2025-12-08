import { NextResponse } from "next/server";

import { JobCandidateStatus } from "@prisma/client";

import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { recordAuditEvent } from "@/lib/audit/trail";
import { getClientIp } from "@/lib/request/ip";
import { prisma } from "@/lib/prisma";

function parseRequestBody(body: unknown) {
  const { jobCandidateId, status } = (body ?? {}) as {
    jobCandidateId?: string;
    status?: string;
  };

  if (!jobCandidateId || !status) {
    return { error: "jobCandidateId and status are required" } as const;
  }

  if (typeof jobCandidateId !== "string" || typeof status !== "string") {
    return { error: "jobCandidateId and status must be strings" } as const;
  }

  const parsedStatus = status as JobCandidateStatus;
  const validStatuses = new Set(Object.values(JobCandidateStatus));

  if (!validStatuses.has(parsedStatus)) {
    return { error: "Invalid status value" } as const;
  }

  return { jobCandidateId, parsedStatus } as const;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedBody = parseRequestBody(body);

  if ("error" in parsedBody) {
    return NextResponse.json({ error: parsedBody.error }, { status: 400 });
  }

  const { jobCandidateId, parsedStatus } = parsedBody;
  const ipAddress = getClientIp(req.headers);

  try {
    const jobCandidate = await prisma.jobCandidate.findUnique({
      where: { id: jobCandidateId },
    });

    if (!jobCandidate) {
      return NextResponse.json({ error: "JobCandidate not found" }, { status: 404 });
    }

    if (!isAdminRole(user.role) && jobCandidate.userId && jobCandidate.userId !== user.id) {
      await recordAuditEvent({
        action: "JOB_CANDIDATE_STATUS_DENIED",
        resource: "JobCandidate",
        resourceId: jobCandidateId,
        userId: user.id,
        metadata: { attemptedStatus: parsedStatus, owner: jobCandidate.userId },
        ip: ipAddress,
      });

      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedJobCandidate = await prisma.jobCandidate.update({
      where: { id: jobCandidateId },
      data: { status: parsedStatus, userId: jobCandidate.userId ?? user.id },
    });

    await recordAuditEvent({
      action: "JOB_CANDIDATE_STATUS_UPDATED",
      resource: "JobCandidate",
      resourceId: jobCandidateId,
      userId: user.id,
      metadata: { previousStatus: jobCandidate.status, newStatus: parsedStatus },
      ip: ipAddress,
    });

    return NextResponse.json(updatedJobCandidate);
  } catch (error) {
    console.error("Failed to update job candidate status", error);
    return NextResponse.json({ error: "Unable to update job candidate status" }, { status: 500 });
  }
}
