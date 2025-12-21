import { NextRequest, NextResponse } from "next/server";

<<<<<<< ours
import { getCurrentUser } from "@/lib/auth/user";
import { listDecisionArtifacts, type DecisionArtifactStatus } from "@/server/decision/decisionArtifacts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseStatus(value: string | null): DecisionArtifactStatus | undefined {
  if (!value) return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === "draft" || normalized === "published") {
    return normalized as DecisionArtifactStatus;
  }

  throw new Error("invalid-status");
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  let status: DecisionArtifactStatus | undefined;

  try {
    status = parseStatus(searchParams.get("status"));
  } catch {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const search = searchParams.get("q")?.trim() || undefined;
  const takeParam = Number(searchParams.get("take"));
  const take = Number.isFinite(takeParam) && takeParam > 0 ? Math.min(takeParam, 500) : 200;

  try {
    const decisions = await listDecisionArtifacts({
      tenantId: user.tenantId,
      userId: user.id,
      status,
      search,
      take,
    });

    return NextResponse.json({ decisions }, { status: 200 });
  } catch (error) {
    console.error("[fulfillment/decisions] Failed to load decision artifacts", error);
    return NextResponse.json({ error: "Unable to load decisions" }, { status: 500 });
=======
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { canCreateDecisionArtifact, canViewFulfillment } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { createDecisionArtifact, decisionArtifactSchema, listDecisionArtifacts } from "@/server/decision/decisionArtifacts";
import { ZodError } from "zod";

async function requireUser(req: NextRequest) {
  const user = await getCurrentUser(req);

  if (!user) {
    return { errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  return { user } as const;
}

export async function GET(req: NextRequest) {
  const userResult = await requireUser(req);

  if ("errorResponse" in userResult) {
    return userResult.errorResponse;
  }

  const { user } = userResult;

  if (!canViewFulfillment(user, user.tenantId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId")?.trim() || undefined;
  const candidateId = searchParams.get("candidateId")?.trim() || undefined;

  try {
    const artifacts = await listDecisionArtifacts({
      tenantId: user.tenantId ?? DEFAULT_TENANT_ID,
      filters: { jobId, candidateId },
    });

    return NextResponse.json({ artifacts }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "jobId or candidateId is required" }, { status: 400 });
    }

    console.error("Failed to list decision artifacts", error);
    return NextResponse.json({ error: "Unable to fetch decision artifacts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userResult = await requireUser(req);

  if ("errorResponse" in userResult) {
    return userResult.errorResponse;
  }

  const { user } = userResult;

  if (!canCreateDecisionArtifact(user, user.tenantId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = decisionArtifactSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid decision artifact payload" }, { status: 400 });
  }

  try {
    const artifact = await createDecisionArtifact({
      tenantId: user.tenantId ?? DEFAULT_TENANT_ID,
      payload: parsed.data,
      user,
    });

    return NextResponse.json({ artifact }, { status: 201 });
  } catch (error) {
    console.error("Failed to create decision artifact", error);
    return NextResponse.json({ error: "Unable to create decision artifact" }, { status: 500 });
>>>>>>> theirs
  }
}
