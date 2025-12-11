import { NextResponse, type NextRequest } from "next/server";

import { getGuardrailPreviewSample, listGuardrailPreviewSamples } from "@/lib/guardrails/previewSamples";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";
import { getCurrentUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const searchParams = new URL(request.url).searchParams;
  const sampleShortlist = searchParams.get("sampleShortlist") ?? "sample5";

  const user = await getCurrentUser(request);
  const roleHint = getTenantRoleFromHeaders(request.headers);
  const access = await resolveTenantAdminAccess(user, tenantId, { roleHint });

  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scenario = getGuardrailPreviewSample(sampleShortlist);

  if (!scenario) {
    return NextResponse.json({ error: "Sample shortlist not found" }, { status: 404 });
  }

  return NextResponse.json({
    sampleShortlist,
    scenario,
    availableSamples: listGuardrailPreviewSamples(),
  });
}
