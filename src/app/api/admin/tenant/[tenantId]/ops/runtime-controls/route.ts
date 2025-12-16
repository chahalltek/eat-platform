import { NextResponse, type NextRequest } from "next/server";

import { requireGlobalOrTenantAdmin } from "@/lib/auth/requireGlobalOrTenantAdmin";
import { buildRuntimeControlsContract } from "@/lib/ops/runtimeControls";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const access = await requireGlobalOrTenantAdmin(request, tenantId);

  if (!access.ok) {
    return access.response;
  }

  const contract = await buildRuntimeControlsContract(tenantId);

  return NextResponse.json(contract);
}
