import { NextResponse, type NextRequest } from "next/server";

import { canViewEnvironment } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { getLlmSafetyStatus } from "@/server/ai/safety/config";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canViewEnvironment(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = getLlmSafetyStatus();

  return NextResponse.json(status, { status: status.ok ? 200 : 503 });
}
