import { NextResponse, type NextRequest } from "next/server";

import { canManageTenants } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { listTenantsWithPlans } from "@/lib/admin/tenants";

export const dynamic = "force-dynamic";

function serializeTenant(tenant: Awaited<ReturnType<typeof listTenantsWithPlans>>[number]) {
  return {
    ...tenant,
    createdAt: tenant.createdAt.toISOString(),
    trialEndsAt: tenant.trialEndsAt ? tenant.trialEndsAt.toISOString() : null,
  };
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!canManageTenants(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenants = await listTenantsWithPlans();

  return NextResponse.json({ tenants: tenants.map(serializeTenant) });
}
