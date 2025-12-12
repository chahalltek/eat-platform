import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/user";
import { getMarketSignals } from "@/lib/learning/marketSignals";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const roleFamily = searchParams.get("roleFamily");
  const region = searchParams.get("region");

  const signals = await getMarketSignals({ roleFamily, region });

  return NextResponse.json(signals);
}
