import { NextRequest, NextResponse } from "next/server";

import { HiringManagerFeedbackStatus, HiringManagerFeedbackType, Prisma } from "@prisma/client";
import { z } from "zod";

import type { IdentityUser } from "@/lib/auth/identityProvider";
import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { getTenantScopedPrismaClient, toTenantErrorResponse } from "@/lib/agents/tenantScope";
import { parseJobIntentPayload } from "@/lib/jobIntent";
import { onJobChanged } from "@/lib/orchestration/triggers";

const requirementSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["skill", "location", "seniority", "employmentType", "summary", "other"]),
  label: z.string().min(1),
  normalizedLabel: z.string().nullable().optional(),
  weight: z.number(),
  confidence: z.number(),
  required: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const feedbackPayloadSchema = z
  .object({
    summary: z.string().nullable().optional(),
    requirements: z.array(requirementSchema).optional(),
    confidenceLevels: z.record(z.string(), z.number()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .optional();

const feedbackSchema = z.object({
  jobIntentId: z.string().trim().optional(),
  candidateId: z.string().trim().optional(),
  feedbackType: z.nativeEnum(HiringManagerFeedbackType),
  payload: feedbackPayloadSchema,
});

type RouteContext = { params: { jobReqId: string } } | { params: Promise<{ jobReqId: string }> };
type TenantScope = Awaited<ReturnType<typeof getTenantScopedPrismaClient>>;

type TenantMembershipResult =
  | { errorResponse: NextResponse }
  | {
      user: IdentityUser;
      tenantScope: TenantScope;
      jobReqId: string;
    };

async function ensureTenantMembership(req: NextRequest, context: RouteContext): Promise<TenantMembershipResult> {
  const user = await getCurrentUser(req);

  if (!user) {
    return { errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  let tenantScope;

  try {
    tenantScope = await getTenantScopedPrismaClient(req);
  } catch (error) {
    const tenantError = toTenantErrorResponse(error);

    if (tenantError) {
      return { errorResponse: tenantError };
    }

    throw error;
  }

  const { prisma, tenantId } = tenantScope;

  if (!isAdminRole(user.role)) {
    const membership = await prisma.tenantUser.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId } },
    });

    if (!membership) {
      return { errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
  }

  const { jobReqId } = await Promise.resolve(context.params);

  return { user, tenantScope, jobReqId };
}

export async function POST(req: NextRequest, context: RouteContext) {
  const membership = await ensureTenantMembership(req, context);

  if ("errorResponse" in membership) {
    return membership.errorResponse;
  }

  const { user, tenantScope, jobReqId } = membership;
  const { prisma, tenantId } = tenantScope;

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid feedback payload" }, { status: 400 });
  }

  const { jobIntentId, candidateId, feedbackType, payload } = parsed.data;
  const jobReq = await prisma.jobReq.findFirst({ where: { id: jobReqId, tenantId } });

  if (!jobReq) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const existingIntent = jobIntentId
    ? await prisma.jobIntent.findFirst({ where: { id: jobIntentId, jobReqId, tenantId } })
    : await prisma.jobIntent.findFirst({ where: { jobReqId, tenantId } });

  if (jobIntentId && !existingIntent) {
    return NextResponse.json({ error: "JobIntent not found for job" }, { status: 404 });
  }

  const feedbackRecord = await prisma.hiringManagerFeedback.create({
    data: {
      jobReqId,
      jobIntentId: existingIntent?.id ?? jobIntentId ?? null,
      candidateId: candidateId ?? null,
      feedbackType,
      status: HiringManagerFeedbackStatus.SUBMITTED,
      payload: (payload ?? {}) as Prisma.InputJsonValue,
    },
  });

  let updatedIntentId = existingIntent?.id ?? null;

  const shouldUpdateIntent = Boolean(
    payload?.requirements?.length || payload?.confidenceLevels || payload?.summary || payload?.metadata,
  );

  if (shouldUpdateIntent) {
    const parsedPayload = parseJobIntentPayload(existingIntent?.intent) ?? {
      summary: null,
      requirements: [],
      weightings: {},
      confidenceLevels: {},
      metadata: {},
    };

    const mergedPayload = {
      summary: payload?.summary ?? parsedPayload.summary ?? null,
      requirements: payload?.requirements ?? parsedPayload.requirements ?? [],
      weightings: parsedPayload.weightings ?? {},
      confidenceLevels: {
        ...(parsedPayload.confidenceLevels ?? {}),
        ...(payload?.confidenceLevels ?? {}),
      },
      metadata: {
        ...(parsedPayload.metadata ?? {}),
        ...(payload?.metadata ?? {}),
      },
    } satisfies ReturnType<typeof parseJobIntentPayload>;

    const updatedIntent = await prisma.jobIntent.upsert({
      where: { jobReqId },
      update: { intent: mergedPayload as unknown as Prisma.InputJsonValue, tenantId },
      create: {
        jobReqId,
        tenantId,
        intent: mergedPayload as unknown as Prisma.InputJsonValue,
        createdById: user.id,
      },
    });

    updatedIntentId = updatedIntent.id;

    await prisma.hiringManagerFeedback.update({
      where: { id: feedbackRecord.id },
      data: { status: HiringManagerFeedbackStatus.PROCESSED, jobIntentId: updatedIntentId },
    });

    void onJobChanged({ tenantId, jobId: jobReqId });
  }

  return NextResponse.json(
    {
      id: feedbackRecord.id,
      status: shouldUpdateIntent ? HiringManagerFeedbackStatus.PROCESSED : feedbackRecord.status,
      jobIntentId: updatedIntentId,
    },
    { status: 201 },
  );
}
