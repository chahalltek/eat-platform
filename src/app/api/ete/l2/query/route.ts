import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/requireRole";
import { isAdminRole, USER_ROLES } from "@/lib/auth/roles";
import { runRiskiestReqs } from "@/lib/agents/l2/riskiestReqs";
import { runScarcityHotspots } from "@/lib/agents/l2/scarcityHotspots";
import type { L2Input, L2Question, L2Result } from "@/lib/agents/l2/types";

const bodySchema = z.object({
  question: z.union([
    z.literal("RISKIEST_REQS"),
    z.literal("SCARCITY_HOTSPOTS"),
    z.literal("PRESET_RECOMMENDATIONS"),
    z.literal("HIRING_VELOCITY_ALERTS"),
  ]),
  scope: z
    .object({
      roleFamily: z.string().trim().optional(),
      region: z.string().trim().optional(),
      industry: z.string().trim().optional(),
      horizonDays: z.union([z.literal(30), z.literal(60), z.literal(90)]).optional(),
    })
    .optional(),
});

type L2Handler = (input: L2Input, options?: { bypassCache?: boolean }) => Promise<L2Result>;

const AGENT_HANDLERS: Record<L2Question, L2Handler | null> = {
  RISKIEST_REQS: runRiskiestReqs,
  SCARCITY_HOTSPOTS: runScarcityHotspots,
  PRESET_RECOMMENDATIONS: null,
  HIRING_VELOCITY_ALERTS: null,
};

export async function POST(req: NextRequest) {
  const roleCheck = await requireRole(req, [
    USER_ROLES.ADMIN,
    USER_ROLES.SYSTEM_ADMIN,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.EXEC,
  ]);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const handler = AGENT_HANDLERS[parsed.data.question];

  if (!handler) {
    return NextResponse.json({ error: "Question not yet supported" }, { status: 501 });
  }

  const tenantId = roleCheck.user.tenantId;

  if (!tenantId) {
    return NextResponse.json({ error: "Tenant missing" }, { status: 400 });
  }

  const result = await handler({ tenantId, scope: parsed.data.scope }, {
    bypassCache: isAdminRole(roleCheck.user.role),
  });

  return NextResponse.json(result);
}
