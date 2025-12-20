import { NextRequest, NextResponse } from "next/server";

import { decisionReceiptSchema, createDecisionReceipt, listDecisionReceipts } from "@/server/decision/decisionReceipts";
import { DEFAULT_TENANT_ID } from "@/lib/auth/config";
import { requireRecruiterOrAdmin } from "@/lib/auth/requireRole";

export async function GET(req: NextRequest) {
  const roleCheck = await requireRecruiterOrAdmin(req);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId")?.trim();
  const candidateId = searchParams.get("candidateId")?.trim() || null;
  const tenantId = (roleCheck.user.tenantId ?? DEFAULT_TENANT_ID).trim();

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  try {
    const receipts = await listDecisionReceipts({
      tenantId,
      jobId,
      candidateId,
    });

    return NextResponse.json({ receipts });
  } catch (error) {
    console.error("Failed to fetch decision receipts", error);
    return NextResponse.json({ error: "Unable to load decision receipts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const roleCheck = await requireRecruiterOrAdmin(req);

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const body = await req.json().catch(() => null);
  const parsed = decisionReceiptSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid decision receipt payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const tenantId = (roleCheck.user.tenantId ?? DEFAULT_TENANT_ID).trim();

  try {
    const receipt = await createDecisionReceipt({
      tenantId,
      payload: parsed.data,
      user: roleCheck.user,
    });

    return NextResponse.json({ receipt, bullhornNote: receipt.bullhornNote }, { status: 201 });
  } catch (error) {
    console.error("Failed to create decision receipt", error);
    return NextResponse.json({ error: "Unable to create decision receipt" }, { status: 500 });
  }
}
