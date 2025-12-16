import { NextResponse, type NextRequest } from "next/server";

import { requireGlobalOrTenantAdmin } from "@/lib/auth/requireGlobalOrTenantAdmin";
import { buildTenantDiagnostics, TenantNotFoundError } from "@/lib/tenant/diagnostics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const access = await requireGlobalOrTenantAdmin(request, tenantId);

  if (!access.ok) {
    return access.response;
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
