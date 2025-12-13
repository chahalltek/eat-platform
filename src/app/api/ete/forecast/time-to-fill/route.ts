import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/user";
import { isAdminRole } from "@/lib/auth/roles";
import { getTimeToFillRisksForTenant } from "@/lib/forecast/timeToFillRisk";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const risks = await getTimeToFillRisksForTenant(user.tenantId ?? "default-tenant", {
      bypassCache: isAdminRole(user.role),
    });

    return NextResponse.json({ generatedAt: new Date().toISOString(), risks });
  } catch (error) {
    console.error("[forecast] Unable to build time-to-fill risks", error);
    return NextResponse.json(
      { error: "Forecasts are unavailable right now.", risks: [] },
      { status: 503 },
    );
  }
}
