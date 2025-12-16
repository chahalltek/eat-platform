import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { logGuardrailsUpdate } from "@/lib/audit/adminAudit";
<<<<<<< ours
import { requireGlobalOrTenantAdmin } from "@/lib/auth/requireGlobalOrTenantAdmin";
=======
import { getCurrentUser } from "@/lib/auth/user";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";
>>>>>>> theirs
import { defaultTenantGuardrails, guardrailsSchema, loadTenantGuardrails, saveTenantGuardrails } from "@/lib/tenant/guardrails";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GuardrailsPayload = z.infer<typeof guardrailsSchema>;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
<<<<<<< ours
  const access = await requireGlobalOrTenantAdmin(request, tenantId);
  if (!access.ok) {
    return access.response;
=======
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roleHint = getTenantRoleFromHeaders(request.headers);
  const access = await resolveTenantAdminAccess(user, tenantId, { roleHint });

  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
>>>>>>> theirs
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
<<<<<<< ours
    const access = await requireGlobalOrTenantAdmin(request, tenantId);
    if (!access.ok) {
      return access.response;
=======
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roleHint = getTenantRoleFromHeaders(request.headers);
    const access = await resolveTenantAdminAccess(user, tenantId, { roleHint });

    if (!access.hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
>>>>>>> theirs
    }

    const payload = guardrailsSchema.parse(await request.json()) as GuardrailsPayload;

    await saveTenantGuardrails(tenantId, payload);

    await logGuardrailsUpdate({
      tenantId,
<<<<<<< ours
      actorId: access.access.actorId,
=======
      actorId: user.id,
>>>>>>> theirs
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
