import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/user";
import { getClientRelativeBenchmarks } from "@/lib/benchmarks/clientRelativeBenchmarks";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user || !user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const roleFamily = searchParams.get("roleFamily");

  const benchmarking = await getClientRelativeBenchmarks({ tenantId: user.tenantId, roleFamily });

  return NextResponse.json(benchmarking);
}
