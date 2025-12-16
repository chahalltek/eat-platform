import { NextRequest, NextResponse } from "next/server";

import { requireTenantAdmin } from "@/lib/auth/requireTenantAdmin";
import { buildRuntimeControlsContract } from "@/lib/ops/runtimeControls";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const access = await requireTenantAdmin(request, tenantId);

  if (!access.ok) {
    return access.response;
  }

  const contract = await buildRuntimeControlsContract(tenantId);

  return NextResponse.json(contract);
}
