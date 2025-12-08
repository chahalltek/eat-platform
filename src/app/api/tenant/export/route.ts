import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";
import { buildTenantExportArchive } from "@/lib/export/tenantExport";

export async function POST(req: NextRequest) {
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
    const { archive } = await buildTenantExportArchive(tenantId);

    return new NextResponse(archive, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=tenant-${tenantId}-export.zip`,
      },
    });
  } catch (error) {
    console.error("Failed to build tenant export", error);
    return NextResponse.json({ error: "Unable to generate export" }, { status: 500 });
  }
}
