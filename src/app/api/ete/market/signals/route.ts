import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/user";
import { getMarketSignals } from "@/lib/market/marketSignals";
import { loadTenantMode } from "@/lib/modes/loadTenantMode";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const roleFamily = searchParams.get("roleFamily");
  const region = searchParams.get("region");

  const mode = user.tenantId ? await loadTenantMode(user.tenantId) : null;

  const signals = await getMarketSignals({ roleFamily, region, systemMode: mode?.mode });

  return NextResponse.json(signals);
}
