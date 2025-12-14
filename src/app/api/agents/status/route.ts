import { NextResponse } from "next/server";

import { getAgentsStatus } from "@/lib/agents/statusBoard";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { assertFeatureEnabled } from "@/lib/featureFlags/middleware";

export const dynamic = "force-dynamic";

export async function GET() {
  const featureCheck = await assertFeatureEnabled(FEATURE_FLAGS.AGENTS, { featureName: "Agents" });

  if (featureCheck) {
    return featureCheck;
  }

  const payload = await getAgentsStatus();

  return NextResponse.json(payload);
}
