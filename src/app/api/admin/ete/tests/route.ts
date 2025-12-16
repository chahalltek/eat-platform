import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/user";
import { getEteTestCatalog } from "@/lib/ete/testCatalog";
import { computeMatchScore } from "@/lib/matching/msa";
import { computeMatchConfidence } from "@/lib/matching/confidence";
import { getCurrentTenantId } from "@/lib/tenant";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";

const CACHE_CONTROL_VALUE = "private, max-age=300";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = (await getCurrentTenantId(request)) ?? DEFAULT_TENANT_ID;
  const access = await resolveTenantAdminAccess(user, tenantId, {
    roleHint: getTenantRoleFromHeaders(request.headers),
  });

  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const catalog = getEteTestCatalog();
  const response = NextResponse.json(catalog);

  response.headers.set("Cache-Control", CACHE_CONTROL_VALUE);
  response.headers.set("CDN-Cache-Control", CACHE_CONTROL_VALUE);
  response.headers.set("Vercel-CDN-Cache-Control", CACHE_CONTROL_VALUE);

  return response;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = (await getCurrentTenantId(request)) ?? DEFAULT_TENANT_ID;
  const access = await resolveTenantAdminAccess(user, tenantId, {
    roleHint: getTenantRoleFromHeaders(request.headers),
  });

  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) ?? {};

  if (body?.scoring) {
    computeMatchScore({} as any);
    computeMatchConfidence({} as any);
  }

  return NextResponse.json([]);
}
