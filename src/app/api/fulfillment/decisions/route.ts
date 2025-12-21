import { NextRequest, NextResponse } from "next/server";

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
  }
}
