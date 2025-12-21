import { NextRequest, NextResponse } from "next/server";

import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { canPublishDecisionArtifact } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { publishDecisionArtifact } from "@/server/decision/decisionArtifacts";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canPublishDecisionArtifact(user, user.tenantId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const artifact = await publishDecisionArtifact({
      id,
      tenantId: user.tenantId ?? DEFAULT_TENANT_ID,
    });

    if (!artifact) {
      return NextResponse.json({ error: "Decision artifact not found" }, { status: 404 });
    }

    return NextResponse.json({ artifact }, { status: 200 });
  } catch (error) {
    console.error("Failed to publish decision artifact", error);
    return NextResponse.json({ error: "Unable to publish decision artifact" }, { status: 500 });
  }
}
