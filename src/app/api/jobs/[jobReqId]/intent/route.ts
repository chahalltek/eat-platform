import { NextRequest, NextResponse } from "next/server";

import { requireRecruiterOrAdmin } from "@/lib/auth/requireRole";
import { getTenantScopedPrismaClient, toTenantErrorResponse } from "@/lib/agents/tenantScope";
import { parseJobIntentPayload, upsertJobIntent } from "@/lib/jobIntent";

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobReqId: string }> }) {
  const roleCheck = await requireRecruiterOrAdmin(req);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  let scopedTenant;

  try {
    scopedTenant = await getTenantScopedPrismaClient(req);
  } catch (error) {
    const tenantError = toTenantErrorResponse(error);

    if (tenantError) {
      return tenantError;
    }

    throw error;
  }

  const { prisma, tenantId } = scopedTenant;
  const { jobReqId } = await params;

  const jobIntent = await prisma.jobIntent.findFirst({
    where: { jobReqId: jobReqId, tenantId },
  });

  if (!jobIntent) {
    return NextResponse.json({ error: "JobIntent not found" }, { status: 404 });
  }

  return NextResponse.json(jobIntent, { status: 200 });
}

async function handleMutation(
  req: NextRequest,
  { params }: { params: Promise<{ jobReqId: string }> },
): Promise<NextResponse> {
  const roleCheck = await requireRecruiterOrAdmin(req);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  let scopedTenant;

  try {
    scopedTenant = await getTenantScopedPrismaClient(req);
  } catch (error) {
    const tenantError = toTenantErrorResponse(error);

    if (tenantError) {
      return tenantError;
    }

    throw error;
  }

  const { prisma, tenantId } = scopedTenant;
  const { jobReqId } = await params;

  let body: unknown;

  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsedPayload = parseJobIntentPayload((body as any)?.payload ?? body);

  if (!parsedPayload) {
    return NextResponse.json({ error: "Invalid job intent payload" }, { status: 400 });
  }

  const jobIntent = await upsertJobIntent(prisma, {
    jobReqId,
    tenantId,
    payload: parsedPayload,
    createdById: roleCheck.user?.id ?? null,
  });

  const status = req.method === "POST" ? 201 : 200;

  return NextResponse.json(jobIntent, { status });
}

export async function POST(req: NextRequest, context: { params: Promise<{ jobReqId: string }> }) {
  return handleMutation(req, context);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ jobReqId: string }> }) {
  return handleMutation(req, context);
}
