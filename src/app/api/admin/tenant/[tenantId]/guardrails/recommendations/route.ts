import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";

import { guardrailRecommendationEngine } from "@/lib/guardrails/recommendations";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";
import { getCurrentUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const user = await getCurrentUser(request);
    const roleHint = getTenantRoleFromHeaders(request.headers);
    const access = await resolveTenantAdminAccess(user, tenantId, { roleHint });

    if (!access.hasAccess) {
      return NextResponse.json({ error: "Forbidden", suggestions: [] }, { status: 403 });
    }

    const recommendations = await guardrailRecommendationEngine.generate(tenantId);
    return NextResponse.json({ recommendations, suggestions: [] });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
      return NextResponse.json({
        recommendations: [],
        suggestions: [],
        status: "unavailable",
        reason: "schema-mismatch",
      });
    }

    console.error("Failed to generate guardrail recommendations", error);
    return NextResponse.json(
      { error: { code: "guardrail_recommendations_unavailable", message: "Unable to generate guardrail recommendations" }, suggestions: [] },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const user = await getCurrentUser(request);
    const roleHint = getTenantRoleFromHeaders(request.headers);
    const access = await resolveTenantAdminAccess(user, tenantId, { roleHint });

    if (!access.hasAccess) {
      return NextResponse.json({ error: "Forbidden", suggestions: [] }, { status: 403 });
    }

    const payload = (await request.json()) as { recommendationId?: string; action?: "approve" | "dismiss" };

    if (!payload.recommendationId || !payload.action) {
      return NextResponse.json({ error: "Invalid payload", suggestions: [] }, { status: 400 });
    }

    const status = payload.action === "approve" ? "applied" : "dismissed";
    const recommendations = await guardrailRecommendationEngine.updateStatus(tenantId, payload.recommendationId, status);

    return NextResponse.json({ recommendations, suggestions: [] });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
      return NextResponse.json({
        recommendations: [],
        suggestions: [],
        status: "unavailable",
        reason: "schema-mismatch",
      });
    }

    console.error("Failed to update guardrail recommendation status", error);
    return NextResponse.json(
      { error: { code: "guardrail_recommendations_unavailable", message: "Unable to update guardrail recommendations" }, suggestions: [] },
      { status: 503 },
    );
  }
}

