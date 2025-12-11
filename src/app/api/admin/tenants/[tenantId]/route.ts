import { NextResponse, type NextRequest } from "next/server";

import { canManageTenants } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/user";
import { getTenantPlanDetail, NotFoundError, updateTenantPlan, ValidationError } from "@/lib/admin/tenants";

export const dynamic = "force-dynamic";

function parseTrialEndDate(raw: unknown) {
  if (!raw) return null;

  const parsed = new Date(String(raw));
  return parsed;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  const user = await getCurrentUser(request);

  if (!canManageTenants(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const detail = await getTenantPlanDetail(tenantId);

      return NextResponse.json({
        tenant: {
          ...detail.tenant,
          createdAt: detail.tenant.createdAt.toISOString(),
          trialEndsAt: detail.tenant.trialEndsAt ? detail.tenant.trialEndsAt.toISOString() : null,
          mode: detail.tenant.mode,
        },
        plans: detail.plans,
      });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    throw error;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  const user = await getCurrentUser(request);

  if (!canManageTenants(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const planId = body?.planId;

    if (!planId || typeof planId !== "string") {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    const summary = await updateTenantPlan(tenantId, planId, {
      isTrial: Boolean(body?.isTrial),
      trialEndsAt: parseTrialEndDate(body?.trialEndsAt),
    });

      return NextResponse.json({
        tenant: {
          ...summary,
          createdAt: summary.createdAt.toISOString(),
          trialEndsAt: summary.trialEndsAt ? summary.trialEndsAt.toISOString() : null,
          mode: summary.mode,
        },
      });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }
}
