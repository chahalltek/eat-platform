import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/user";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { assertFeatureEnabled } from "@/lib/featureFlags/middleware";
import { AgentRegistry } from "@/server/agents/registry";

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser(req);

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentName = req.nextUrl.searchParams.get("agent");

  if (!agentName) {
    return NextResponse.json({ error: "agent is required" }, { status: 400 });
  }

  const flagCheck = await assertFeatureEnabled(FEATURE_FLAGS.AGENTS, { featureName: "Agents" });

  if (flagCheck) {
    return flagCheck;
  }

  const agentDefinition = AgentRegistry[agentName];

  if (!agentDefinition) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  let body: unknown = {};

  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const result = await agentDefinition.run({ input: body, ctx: { currentUser, req } });
    const traceId = (result as { agentRunId?: string }).agentRunId ?? null;

    return NextResponse.json({ ok: true, result, traceId });
  } catch (err) {
    if (err instanceof NextResponse) {
      return err;
    }

    if (err instanceof Response) {
      return new NextResponse(err.body, {
        status: err.status,
        statusText: err.statusText,
        headers: err.headers,
      });
    }

    console.error("Agent run failed", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
