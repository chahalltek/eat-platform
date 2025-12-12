import { NextResponse, type NextRequest } from "next/server";

import { guardrailRecommendationEngine } from "@/lib/guardrails/recommendations";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";
import { getCurrentUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const user = await getCurrentUser(request);
  const roleHint = getTenantRoleFromHeaders(request.headers);
  const access = await resolveTenantAdminAccess(user, tenantId, { roleHint });

  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const recommendations = await guardrailRecommendationEngine.generate(tenantId);
  return NextResponse.json({ recommendations });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const user = await getCurrentUser(request);
  const roleHint = getTenantRoleFromHeaders(request.headers);
  const access = await resolveTenantAdminAccess(user, tenantId, { roleHint });

  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = (await request.json()) as { recommendationId?: string; action?: "approve" | "dismiss" };

  if (!payload.recommendationId || !payload.action) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const status = payload.action === "approve" ? "applied" : "dismissed";
  const recommendations = await guardrailRecommendationEngine.updateStatus(tenantId, payload.recommendationId, status);

  return NextResponse.json({ recommendations });
}

