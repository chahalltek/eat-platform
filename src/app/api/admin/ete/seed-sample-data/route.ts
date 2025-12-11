import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { seedEatSampleData } from "@/lib/testing/sampleDataSeeder";
import { getCurrentTenantId } from "@/lib/tenant";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  const tenantId = (await getCurrentTenantId(request)) ?? DEFAULT_TENANT_ID;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const normalizedTenant = tenantId.trim();
  const userTenant = (user.tenantId ?? DEFAULT_TENANT_ID).trim();

  if (!isAdminRole(user.role) || userTenant !== normalizedTenant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await seedEatSampleData(normalizedTenant);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Failed to seed ETE sample data", error);
    return NextResponse.json({ error: "Unable to seed sample data" }, { status: 500 });
  }
}
