import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { setShortlistState } from "@/lib/agents/shortlistState";
import { canRunAgentShortlist } from "@/lib/auth/permissions";
import { requireRole } from "@/lib/auth/requireRole";
import { USER_ROLES } from "@/lib/auth/roles";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { assertFeatureEnabled } from "@/lib/featureFlags/middleware";
import { getCurrentTenantId } from "@/lib/tenant";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";

const requestSchema = z.object({
  matchId: z.string().trim().min(1, "matchId is required"),
  shortlisted: z.boolean(),
  reason: z
    .string()
    .trim()
    .max(500, "Reason must be 500 characters or fewer")
    .optional()
    .nullable(),
});

export async function POST(req: NextRequest) {
  const roleCheck = await requireRole(req, [
    USER_ROLES.ADMIN,
    USER_ROLES.SYSTEM_ADMIN,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.RECRUITER,
    USER_ROLES.FULFILLMENT_RECRUITER,
    USER_ROLES.FULFILLMENT_MANAGER,
  ]);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const tenantIdFromRequest = await getCurrentTenantId(req);
  const permissionUser = {
    ...roleCheck.user,
    role: roleCheck.user.role ?? USER_ROLES.RECRUITER,
    tenantId: roleCheck.user.tenantId ?? tenantIdFromRequest ?? DEFAULT_TENANT_ID,
  };
  const tenantId =
    tenantIdFromRequest === DEFAULT_TENANT_ID && permissionUser.tenantId
      ? permissionUser.tenantId
      : tenantIdFromRequest ?? permissionUser.tenantId ?? DEFAULT_TENANT_ID;

  if (!canRunAgentShortlist(permissionUser, tenantId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const flagCheck = await assertFeatureEnabled(FEATURE_FLAGS.AGENTS, { featureName: "Agents" });

  if (flagCheck) {
    return flagCheck;
  }

  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    const errorMessage = parsed.error.issues.map((issue) => issue.message).join("; ") || "Invalid payload";
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }

  try {
    const result = await setShortlistState(parsed.data, req);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("SHORTLIST update failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const normalized = message.toLowerCase();

    if (normalized.includes("unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (normalized.includes("forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (normalized.includes("not found")) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
