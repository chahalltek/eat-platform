import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { canCreateDecisionDraft, canViewCandidates } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { createDecisionDraft, listDecisionsForJob, toDecisionDto } from "@/server/decision/decisionDrafts";
import { prisma } from "@/server/db/prisma";

const createSchema = z.object({
  jobId: z.string().trim().min(1),
});

function normalizeJobId(jobId: string | null) {
  const normalized = jobId?.trim() ?? "";
  return normalized.length ? normalized : null;
}

export async function GET(req: NextRequest) {
  const jobId = normalizeJobId(req.nextUrl.searchParams.get("jobId"));
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await prisma.jobReq.findUnique({ where: { id: jobId }, select: { tenantId: true } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const tenantId = job.tenantId ?? DEFAULT_TENANT_ID;
  if (!canViewCandidates(user, tenantId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const decisions = await listDecisionsForJob(jobId);
    return NextResponse.json({ decisions: decisions.map(toDecisionDto) });
  } catch (error) {
    console.error("Failed to list decisions", error);
    return NextResponse.json({ error: "Failed to load decisions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const job = await prisma.jobReq.findUnique({ where: { id: parsed.data.jobId }, select: { id: true, tenantId: true } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const tenantId = job.tenantId ?? DEFAULT_TENANT_ID;
  if (!canCreateDecisionDraft(user, tenantId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const decision = await createDecisionDraft({ jobId: job.id, userId: user.id });
    return NextResponse.json({ decision: toDecisionDto(decision) }, { status: 201 });
  } catch (error) {
    console.error("Failed to create decision draft", error);
    return NextResponse.json({ error: "Unable to create decision draft" }, { status: 500 });
  }
}
