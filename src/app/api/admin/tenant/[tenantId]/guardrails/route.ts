import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { logGuardrailsUpdate } from "@/lib/audit/adminAudit";
import { getCurrentUser } from "@/lib/auth/user";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";
import { defaultTenantGuardrails, guardrailsSchema, loadTenantGuardrails, saveTenantGuardrails } from "@/lib/tenant/guardrails";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GuardrailsPayload = z.infer<typeof guardrailsSchema>;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  const user = await getCurrentUser(request);
  const roleHint = getTenantRoleFromHeaders(request.headers);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await resolveTenantAdminAccess(user, tenantId, { roleHint });

  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const guardrails = await loadTenantGuardrails(tenantId);

  return NextResponse.json({ guardrails, defaults: defaultTenantGuardrails });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  try {
    const user = await getCurrentUser(request);
    const roleHint = getTenantRoleFromHeaders(request.headers);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await resolveTenantAdminAccess(user, tenantId, { roleHint });

    if (!access.hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = guardrailsSchema.parse(await request.json()) as GuardrailsPayload;

    await saveTenantGuardrails(tenantId, payload);

    await logGuardrailsUpdate({
      tenantId,
      actorId: user.id,
      preset: payload.preset ?? null,
      scoringStrategy: payload.scoring.strategy,
      thresholds: payload.scoring.thresholds,
      explain: payload.explain,
      safety: payload.safety,
    });

    const guardrails = await loadTenantGuardrails(tenantId);

    return NextResponse.json({ guardrails, defaults: defaultTenantGuardrails });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
