import { NextResponse } from "next/server";

import { getAgentsStatus } from "@/lib/agents/statusBoard";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getAgentsStatus();

  return NextResponse.json(payload);
}
