import { NextRequest, NextResponse } from "next/server";

import { ADMIN_AUDIT_ACTIONS, type AdminAuditAction, listAuditLogs } from "@/lib/audit/adminAudit";
import { canViewAuditLogs } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const ACTION_VALUES = new Set<AdminAuditAction>(Object.values(ADMIN_AUDIT_ACTIONS));

function parseActions(searchParams: URLSearchParams): AdminAuditAction[] | undefined {
  const fromQuery = [
    ...searchParams.getAll("action"),
    ...(searchParams.get("actions")?.split(",") ?? []),
  ].filter(Boolean);

  const filtered = fromQuery.filter((value): value is AdminAuditAction => ACTION_VALUES.has(value as AdminAuditAction));

  return filtered.length ? filtered : undefined;
}

function parseDate(value: string | null) {
  if (!value) return undefined;

  const candidate = new Date(value);
  return Number.isNaN(candidate.getTime()) ? undefined : candidate;
}

function parseLimit(value: string | null) {
  if (!value) return undefined;

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return undefined;

  return parsed;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  const searchParams = new URL(request.url).searchParams;

  const requestedTenant =
    searchParams.get("tenantId")?.trim() || (await getCurrentTenantId(request));

  if (!canViewAuditLogs(user, requestedTenant)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entries = await listAuditLogs({
    tenantId: requestedTenant,
    actions: parseActions(searchParams),
    since: parseDate(searchParams.get("since")),
    actorId: searchParams.get("actorId")?.trim() || undefined,
    limit: parseLimit(searchParams.get("limit")),
  });

  return NextResponse.json({
    entries: entries.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
    })),
  });
}
