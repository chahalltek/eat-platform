import { NextResponse, type NextRequest } from "next/server";

import { listAgentKillSwitches } from "@/lib/agents/killSwitch";
import { getCurrentUser } from "@/lib/auth/user";
import { listFeatureFlags } from "@/lib/featureFlags";
import { isPublicDemoMode } from "@/lib/demoMode";
import { loadTenantMode } from "@/lib/modes/loadTenantMode";
import { SYSTEM_MODES } from "@/lib/modes/systemModes";
import { resolveTenantAdminAccess } from "@/lib/tenant/access";
import { getTenantRoleFromHeaders } from "@/lib/tenant/roles";
import { withTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const user = await getCurrentUser(request);
  const roleHint = getTenantRoleFromHeaders(request.headers);

  const access = await resolveTenantAdminAccess(user, tenantId, { roleHint });

  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await withTenantContext(tenantId, async () => {
    const [mode, killSwitches, featureFlags] = await Promise.all([
      loadTenantMode(tenantId),
      listAgentKillSwitches(tenantId),
      listFeatureFlags(),
    ]);

    const warnings: string[] = [];

    if (mode.mode === "fire_drill") {
      warnings.push("Fire Drill mode active. Non-essential agents are disabled.");
    }

    if (mode.mode === "maintenance") {
      warnings.push("Maintenance mode active. Non-admin traffic is routed to the maintenance page.");
    }

    const latched = killSwitches.filter((item) => item.latched);

    if (latched.length) {
      warnings.push(`Kill switches latched for ${latched.length} agent${latched.length === 1 ? "" : "s"}.`);
    }

    return {
      tenantId,
      executionMode: mode.mode,
      executionModes: [
        {
          id: "production",
          label: "Production",
          description: "Full platform behavior, balanced guardrails, all agents enabled",
        },
        {
          id: "pilot",
          label: "Pilot",
          description: "Conservative defaults with core agents only",
        },
        {
          id: "maintenance",
          label: "Maintenance",
          description: "Take the site offline for non-admin users",
        },
        {
          id: "fire_drill",
          label: "Fire drill",
          description: "Strict guardrails, only essential agents active",
        },
      ] as const,
      killSwitches,
      featureFlags,
      readOnly: isPublicDemoMode(),
      warnings,
      supportedModes: SYSTEM_MODES,
    };
  });
  return NextResponse.json(payload);
}
