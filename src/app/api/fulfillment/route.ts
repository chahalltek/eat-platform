import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";

export async function GET(request: NextRequest) {
  const permissionCheck = await requirePermission(request, "fulfillment.view");
  if (!permissionCheck.ok) {
    return permissionCheck.response;
  }

  return NextResponse.json({ status: "ok" });
}
