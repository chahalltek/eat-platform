import { NextRequest, NextResponse } from "next/server";

import { logModeChange } from "@/lib/audit/adminAudit";
import { logRuntimeModeChanged } from "@/lib/audit/securityEvents";
import { requireTenantAdmin } from "@/lib/auth/requireTenantAdmin";
import { SYSTEM_MODES, type SystemModeName } from "@/lib/modes/systemModes";
import {
  isRuntimeControlsWriteEnabled,
  loadRuntimeControlMode,
  persistRuntimeControlMode,
} from "@/lib/runtimeControls/mode";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

const VALID_MODES = Object.keys(SYSTEM_MODES) as SystemModeName[];

function parseMode(raw: unknown): SystemModeName | null {
  if (typeof raw !== "string") return null;

  const normalized = raw.trim().toLowerCase();
  return VALID_MODES.includes(normalized as SystemModeName)
    ? (normalized as SystemModeName)
    : null;
}

function writeDisabledResponse() {
  return NextResponse.json(
    { error: "Runtime controls have READ-only rights in this environment" },
    { status: 403 },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  const access = await requireTenantAdmin(request, tenantId);

  if (!access.ok) {
    return access.response;
  }

  if (!isRuntimeControlsWriteEnabled()) {
    return writeDisabledResponse();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode = parseMode((body as { mode?: unknown })?.mode);

  if (!mode) {
    return NextResponse.json({ error: "mode is required" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const previous = await loadRuntimeControlMode(tenantId);
  const updated = await persistRuntimeControlMode(tenant, mode);

  await Promise.all([
    logModeChange({ tenantId, actorId: access.user.id, previousMode: previous.mode, newMode: mode }),
    logRuntimeModeChanged({
      tenantId,
      userId: access.user.id,
      previousMode: previous.mode,
      newMode: mode,
      source: updated.source,
    }),
  ]);

  return NextResponse.json({ tenant: updated });
}
