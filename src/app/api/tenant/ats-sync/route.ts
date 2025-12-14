import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";
import { loadLatestAtsSync } from "@/lib/tenant/diagnostics";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  const tenantId = await getCurrentTenantId(req);
  const headerRole = getTenantRoleFromHeaders(req.headers);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await resolveTenantAdminAccess(user, tenantId, { roleHint: headerRole });

  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const latestSync = await loadLatestAtsSync(tenantId);

    return NextResponse.json(latestSync);
  } catch (error) {
    console.error("Failed to fetch latest ATS sync run", error);
    return NextResponse.json({ error: "Unable to load ATS sync run" }, { status: 500 });
  }
}
