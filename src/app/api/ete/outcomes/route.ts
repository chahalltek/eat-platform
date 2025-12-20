import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { USER_ROLES } from "@/lib/auth/roles";
import { prisma } from "@/server/db/prisma";
import {
  HIRING_OUTCOME_SOURCES,
  HIRING_OUTCOME_STATUSES,
  type HiringOutcomeStatus,
} from "@/lib/hiringOutcomes";

const requestSchema = z.object({
  jobId: z.string().trim().min(1, "jobId is required"),
  candidateId: z.string().trim().min(1, "candidateId is required"),
  status: z.enum(HIRING_OUTCOME_STATUSES),
  source: z.enum(HIRING_OUTCOME_SOURCES).default("recruiter"),
  candidateIdString: z.string().trim().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const roleCheck = await requireRole(req, [
    USER_ROLES.ADMIN,
    USER_ROLES.SYSTEM_ADMIN,
    USER_ROLES.TENANT_ADMIN,
  ]);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    const errorMessage = parsed.error.issues.map((issue) => issue.message).join("; ") || "Invalid payload";
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }

  const { jobId, candidateId, status, source, candidateIdString } = parsed.data;

  const job = await prisma.jobReq.findUnique({ where: { id: jobId }, select: { tenantId: true } });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId }, select: { tenantId: true } });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  if (job.tenantId !== candidate.tenantId) {
    return NextResponse.json({ error: "Job and candidate belong to different tenants" }, { status: 400 });
  }

  const outcome = await prisma.hiringOutcome.upsert({
    where: {
      tenantId_jobId_candidateId: { tenantId: job.tenantId, jobId, candidateId },
    },
    create: {
      tenantId: job.tenantId,
      jobId,
      candidateId,
      candidateIdString: candidateIdString ?? candidateId,
      status,
      source,
    },
    update: {
      status,
      source,
      candidateIdString: candidateIdString ?? candidateId,
    },
  });

  return NextResponse.json({
    id: outcome.id,
    jobId: outcome.jobId,
    candidateId: outcome.candidateId,
    status: outcome.status as HiringOutcomeStatus,
    source: outcome.source,
    createdAt: outcome.createdAt,
  });
}
