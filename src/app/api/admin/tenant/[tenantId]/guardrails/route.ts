import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireTenantAdmin } from "@/lib/auth/tenantAdmin";
import { getCurrentUser } from "@/lib/auth/user";
import { defaultTenantGuardrails, loadTenantGuardrails, saveTenantGuardrails } from "@/lib/tenant/guardrails";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  const user = await getCurrentUser(request);

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await requireTenantAdmin(tenantId, user.id);

  if (!access.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const guardrails = await loadTenantGuardrails(tenantId);

  return NextResponse.json({ guardrails, defaults: defaultTenantGuardrails });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  const user = await getCurrentUser(request);

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await requireTenantAdmin(tenantId, user.id);

  if (!access.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { saved } = await saveTenantGuardrails(tenantId, body);

    return NextResponse.json({ guardrails: saved });
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
