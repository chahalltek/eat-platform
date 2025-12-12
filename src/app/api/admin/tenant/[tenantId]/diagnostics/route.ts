import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/user";
import { buildTenantDiagnostics, TenantNotFoundError } from "@/lib/tenant/diagnostics";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const user = await getCurrentUser(request);
  const roleHint = getTenantRoleFromHeaders(request.headers);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await resolveTenantAdminAccess(user, tenantId, { roleHint });

  if (!access.hasAccess) {
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
