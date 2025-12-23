import { NextResponse, type NextRequest } from "next/server";

import { loadTenantMode } from "@/lib/modes/loadTenantMode";
import { getCurrentTenantId } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const tenantId = await getCurrentTenantId(request);
  const mode = await loadTenantMode(tenantId);

  return NextResponse.json({ tenantId, mode: mode.mode, source: mode.source });
}
