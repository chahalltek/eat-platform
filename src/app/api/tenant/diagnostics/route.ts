import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";
import { buildTenantDiagnostics, TenantNotFoundError } from "@/lib/tenant/diagnostics";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  const tenantId = await getCurrentTenantId(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userTenant = (user.tenantId ?? DEFAULT_TENANT_ID).trim();

  if (!isAdminRole(user.role) || userTenant !== tenantId.trim()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const diagnostics = await buildTenantDiagnostics(tenantId);

    return NextResponse.json(diagnostics);
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    console.error("Failed to build tenant diagnostics", error);
    return NextResponse.json({ error: "Unable to load diagnostics" }, { status: 500 });
  }
}
