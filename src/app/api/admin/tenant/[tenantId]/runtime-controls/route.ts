import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/user";
import { listFeatureFlags } from "@/lib/featureFlags";
import { getKillSwitchState, KILL_SWITCHES } from "@/lib/killSwitch";
import { loadTenantMode } from "@/lib/modes/loadTenantMode";
import { SYSTEM_MODES } from "@/lib/modes/systemModes";
import { withTenantContext } from "@/lib/tenant";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { defaultTenantGuardrails, loadTenantGuardrailsWithSchemaStatus } from "@/lib/tenant/guardrails";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";
import { isPrismaUnavailableError } from "@/server/db";

export const dynamic = "force-dynamic";

const DEFAULT_MODE = {
  mode: "pilot",
  guardrailsPreset: SYSTEM_MODES.pilot.guardrailsPreset,
  agentsEnabled: SYSTEM_MODES.pilot.agentsEnabled,
  source: "fallback" as const,
};

async function safeLoadMode(tenantId: string, warnings: string[]) {
  try {
    return await loadTenantMode(tenantId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError || isPrismaUnavailableError(error)) {
      warnings.push("Tenant mode unavailable; using fallback settings.");
      return DEFAULT_MODE;
    }

    throw error;
  }
}

async function safeListFeatureFlags(tenantId: string, warnings: string[]) {
  try {
    return await withTenantContext(tenantId, () => listFeatureFlags());
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError || isPrismaUnavailableError(error)) {
      warnings.push("Feature flags unavailable; using empty flag set.");
      return [];
    }

    throw error;
  }
}

async function safeLoadGuardrails(tenantId: string, warnings: string[]) {
  try {
    const result = await loadTenantGuardrailsWithSchemaStatus(tenantId);

    if (result.schemaStatus.status === "fallback" && result.schemaStatus.reason) {
      warnings.push(result.schemaStatus.reason);
    }

    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError || isPrismaUnavailableError(error)) {
      warnings.push("Guardrails unavailable; using defaults.");
      return {
        guardrails: defaultTenantGuardrails,
        schemaStatus: { status: "fallback", missingColumns: [], reason: "Guardrails unavailable" },
      } as const;
    }

    throw error;
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const user = await getCurrentUser(request);
  const roleHint = getTenantRoleFromHeaders(request.headers);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await resolveTenantAdminAccess(user, tenantId, { roleHint });

  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const warnings: string[] = [];
  const [mode, featureFlags, guardrails] = await Promise.all([
    safeLoadMode(tenantId, warnings),
    safeListFeatureFlags(tenantId, warnings),
    safeLoadGuardrails(tenantId, warnings),
  ]);

  const killSwitches = {
    agents: getKillSwitchState(KILL_SWITCHES.AGENTS),
    scorers: getKillSwitchState(KILL_SWITCHES.SCORERS),
    builders: getKillSwitchState(KILL_SWITCHES.BUILDERS),
  } as const;

  return NextResponse.json({
    mode,
    featureFlags,
    guardrails,
    killSwitches,
    warnings,
  });
}
