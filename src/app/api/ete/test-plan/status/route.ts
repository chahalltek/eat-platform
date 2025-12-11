import { NextRequest, NextResponse } from "next/server";

import { canManageFeatureFlags } from "@/lib/auth/permissions";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/user";
import { listTestPlanStatuses, parseTestPlanStatus, upsertTestPlanStatus } from "@/lib/eat/testPlanStatus";
import { isValidTestPlanItemId } from "@/lib/eat/testPlanRegistry";

async function resolveAdmin(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  if (!canManageFeatureFlags(user)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  }

  return { user } as const;
}

export async function GET(request: NextRequest) {
  const result = await resolveAdmin(request);

  if ("response" in result) {
    return result.response;
  }

  const { user } = result;
  const statuses = await listTestPlanStatuses(user?.tenantId ?? DEFAULT_TENANT_ID);

  return NextResponse.json(statuses);
}

export async function POST(request: NextRequest) {
  const result = await resolveAdmin(request);

  if ("response" in result) {
    return result.response;
  }

  const { user } = result;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { itemId, status, note } = (body ?? {}) as { itemId?: unknown; status?: unknown; note?: unknown };

  if (typeof itemId !== "string" || !isValidTestPlanItemId(itemId)) {
    return NextResponse.json({ error: "itemId is required and must match a registry item" }, { status: 400 });
  }

  const parsedStatus = parseTestPlanStatus(status);

  if (!parsedStatus) {
    return NextResponse.json({ error: "status must be one of: not_run, pass, fail, blocked" }, { status: 400 });
  }

  if (note !== undefined && note !== null && typeof note !== "string") {
    return NextResponse.json({ error: "note must be a string when provided" }, { status: 400 });
  }

  const saved = await upsertTestPlanStatus({
    tenantId: user?.tenantId ?? DEFAULT_TENANT_ID,
    itemId,
    status: parsedStatus,
    note: typeof note === "string" ? note : null,
    updatedBy: user?.email || user?.id || "admin",
  });

  return NextResponse.json({
    ...saved,
    updatedAt: saved.updatedAt.toISOString(),
  });
}
