import { NextRequest, NextResponse } from "next/server";

import { canManageTenants } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { FEATURE_FLAGS, setFeatureFlag } from "@/lib/featureFlags";
import { getCurrentTenantId, withTenantContext } from "@/lib/tenant";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  const tenantId = await getCurrentTenantId(request);
  const headerRole = getTenantRoleFromHeaders(request.headers);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await resolveTenantAdminAccess(user, tenantId, { roleHint: headerRole });

  if (!access.hasAccess && !canManageTenants(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const flag = await withTenantContext(tenantId, () => setFeatureFlag(FEATURE_FLAGS.FIRE_DRILL_MODE, true));

  return NextResponse.json({ enabled: flag.enabled, name: flag.name });
}
