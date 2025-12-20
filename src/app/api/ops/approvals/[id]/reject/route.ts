import { NextRequest } from "next/server";

import { ApprovalStatus } from "@/server/db/prisma";

import { handleApprovalDecision } from "../decisionHandler";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleApprovalDecision(req, ctx.params, ApprovalStatus.REJECTED);
}
