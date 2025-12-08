import { NextResponse } from "next/server";

import { recordHealthCheck, runHealthChecks } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await runHealthChecks();

  try {
    await recordHealthCheck(report);
  } catch (error) {
    console.error("[health] Failed to persist AgentRunLog", error);
  }

  const status = report.status === "ok" ? 200 : 503;

  return NextResponse.json(report, { status });
}
