import { NextResponse } from "next/server";

import { z } from "zod";

import { ingestJob } from "@/lib/matching/matcher";
import { getCurrentTenantId } from "@/lib/tenant";
import { prisma } from "@/server/db";
import { recordMetricEvent } from "@/lib/metrics/events";
import { onJobChanged } from "@/lib/orchestration/triggers";
import { getCurrentUser } from "@/lib/auth/user";
import { normalizeRole, USER_ROLES } from "@/lib/auth/roles";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";

const jobSkillSchema = z.object({
  name: z.string().min(1, "Skill name is required"),
  required: z.boolean().optional(),
  weight: z.number().nonnegative().optional(),
});

const jobSchema = z.object({
  title: z.string().min(1, "title is required"),
  location: z.string().nullable().optional(),
  seniorityLevel: z.string().nullable().optional(),
  rawDescription: z.string().nullable().optional(),
  sourceType: z.string().nullable().optional(),
  sourceTag: z.string().nullable().optional(),
  skills: z.array(jobSkillSchema).default([]),
});

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = jobSchema.safeParse(body);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => (issue.path[0] === "title" ? "title is required" : issue.message))
      .join("; ");
    return NextResponse.json({ error: issues }, { status: 400 });
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = normalizeRole(user.role);

  if (!role || (role !== USER_ROLES.ADMIN && role !== USER_ROLES.SYSTEM_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requestTenantId = await getCurrentTenantId();
  const isSystemAdmin = role === USER_ROLES.SYSTEM_ADMIN;
  const tenantId = isSystemAdmin ? requestTenantId : user.tenantId ?? requestTenantId ?? DEFAULT_TENANT_ID;

  if (!isSystemAdmin && user.tenantId && user.tenantId !== requestTenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const jobReq = await ingestJob({ ...parsed.data }, prisma);

  if (tenantId && jobReq.tenantId !== tenantId) {
    await prisma.jobReq.update({ where: { id: jobReq.id }, data: { tenantId } });
    jobReq.tenantId = tenantId;
  }

  void recordMetricEvent({
    tenantId: jobReq.tenantId,
    eventType: "JOB_CREATED",
    entityId: jobReq.id,
    meta: {
      skillsCount: jobReq.skills?.length ?? 0,
      sourceType: jobReq.sourceType ?? "ingest",
      sourceTag: jobReq.sourceTag,
    },
  });

  void onJobChanged({ tenantId: jobReq.tenantId, jobId: jobReq.id });

  return NextResponse.json(jobReq, { status: 201 });
}

