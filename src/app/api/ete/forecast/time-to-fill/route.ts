import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/user";
import { getTimeToFillRisksForTenant } from "@/lib/forecast/timeToFillRisk";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const risks = await getTimeToFillRisksForTenant(user.tenantId ?? "default-tenant");

  return NextResponse.json({ generatedAt: new Date().toISOString(), risks });
}
