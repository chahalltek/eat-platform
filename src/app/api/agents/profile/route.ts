import { NextResponse, type NextRequest } from "next/server";

import { POST as rinaPost } from "../rina/route";

export async function POST(req: NextRequest) {
  const response = await rinaPost(req);

  if (!response.ok) {
    return response;
  }

  const body = (await response.json()) as { candidateId?: string; agentRunId?: string };

  return NextResponse.json(
    {
      candidateId: body.candidateId,
      agentRunId: body.agentRunId,
    },
    { status: response.status },
  );
}
