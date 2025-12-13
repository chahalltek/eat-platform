import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { logGuardrailsUpdate } from "@/lib/audit/adminAudit";
import { requireTenantAdmin } from "@/lib/auth/requireTenantAdmin";
import { defaultTenantGuardrails, guardrailsSchema, loadTenantGuardrails, saveTenantGuardrails } from "@/lib/tenant/guardrails";

export const dynamic = "force-dynamic";

type GuardrailsPayload = z.infer<typeof guardrailsSchema>;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  const access = await requireTenantAdmin(request, tenantId);
  if (!access.ok) {
    return access.response;
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
    const access = await requireTenantAdmin(request, tenantId);
    if (!access.ok) {
      return access.response;
    }

    const payload = guardrailsSchema.parse(await request.json()) as GuardrailsPayload;

    await saveTenantGuardrails(tenantId, payload);

    await logGuardrailsUpdate({
      tenantId,
      actorId: access.user.id,
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
