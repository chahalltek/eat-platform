import { NextResponse, type NextRequest } from "next/server";

import { canManageFeatureFlags } from "@/lib/auth/permissions";
import { getOpsTestRegistry } from "@/lib/ops/testCatalog";
import { getCurrentUser } from "@/lib/auth/user";

const CACHE_CONTROL_VALUE = "private, max-age=300";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!canManageFeatureFlags(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const registry = getOpsTestRegistry();
  const response = NextResponse.json(registry);

  response.headers.set("Cache-Control", CACHE_CONTROL_VALUE);
  response.headers.set("CDN-Cache-Control", CACHE_CONTROL_VALUE);
  response.headers.set("Vercel-CDN-Cache-Control", CACHE_CONTROL_VALUE);

  return response;
}
