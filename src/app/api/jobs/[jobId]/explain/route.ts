import { NextRequest, NextResponse } from 'next/server';
import { FireDrillAgentDisabledError } from '@/lib/agents/availability';
import { runExplainForJob } from '@/lib/agents/explain';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const body = await req.json().catch(() => ({}));

    const result = await runExplainForJob({
      jobId,
      candidateIds: Array.isArray(body.candidateIds) ? body.candidateIds : undefined,
      tenantId: typeof body.tenantId === "string" ? body.tenantId : undefined,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof FireDrillAgentDisabledError) {
      return NextResponse.json(
        {
          errorCode: "FIRE_DRILL_MODE",
          message: "Explain/Confidence agents are disabled in Fire Drill mode.",
        },
        { status: 503 },
      );
    }

    console.error('EXPLAIN API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
