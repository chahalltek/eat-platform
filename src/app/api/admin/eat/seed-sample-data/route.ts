import { NextResponse, type NextRequest } from "next/server";

<<<<<<< ours
import { getCurrentUser } from "@/lib/auth/user";
import { isAdminRole } from "@/lib/auth/roles";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
=======
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/user";
import { seedEatSampleData } from "@/lib/testing/sampleDataSeeder";
import { getCurrentTenantId } from "@/lib/tenant";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  const tenantId = (await getCurrentTenantId(request)) ?? DEFAULT_TENANT_ID;
>>>>>>> theirs

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

<<<<<<< ours
  if (!isAdminRole(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ message: "Seeding endpoint not enabled in this environment" }, { status: 501 });
=======
  const normalizedTenant = tenantId.trim();
  const userTenant = (user.tenantId ?? DEFAULT_TENANT_ID).trim();

  if (!isAdminRole(user.role) || userTenant !== normalizedTenant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await seedEatSampleData(normalizedTenant);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Failed to seed EAT sample data", error);
    return NextResponse.json({ error: "Unable to seed sample data" }, { status: 500 });
  }
>>>>>>> theirs
}
