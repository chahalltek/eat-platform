import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/user';
import { prisma } from '@/lib/prisma';
import { runOutreach } from '@/lib/agents/outreach';
import { runRina } from '@/lib/agents/rina';
import { runRua } from '@/lib/agents/rua';

function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

async function buildRetryMetadata(runId: string, retryOfId?: string) {
  const rootRunId = retryOfId ?? runId;
  const previousRetries = await prisma.agentRunLog.count({ where: { retryOfId: rootRunId } });

  return { retryOfId: rootRunId, retryCount: previousRetries + 1 } as const;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser(req);

  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const run = await prisma.agentRunLog.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      agentName: true,
      inputSnapshot: true,
      retryOfId: true,
    },
  });

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const retryMetadata = await buildRetryMetadata(run.id, run.retryOfId ?? undefined);

  switch (run.agentName) {
    case 'EAT-TS.RINA': {
      const input = run.inputSnapshot as Record<string, unknown> | null;
      const rawResumeText = asString(input?.rawResumeText);

      if (!rawResumeText) {
        return NextResponse.json({ error: 'Missing rawResumeText for retry' }, { status: 400 });
      }

      const result = await runRina(
        {
          recruiterId: asString(input?.recruiterId) ?? currentUser.id,
          rawResumeText,
          sourceType: asString(input?.sourceType),
          sourceTag: asString(input?.sourceTag),
        },
        retryMetadata,
      );

      return NextResponse.json({ agentRunId: result.agentRunId, retryCount: retryMetadata.retryCount });
    }
    case 'EAT-TS.RUA': {
      const input = run.inputSnapshot as Record<string, unknown> | null;
      const rawJobText = asString(input?.rawJobText);

      if (!rawJobText) {
        return NextResponse.json({ error: 'Missing rawJobText for retry' }, { status: 400 });
      }

      const result = await runRua(
        {
          recruiterId: asString(input?.recruiterId) ?? currentUser.id,
          rawJobText,
          sourceType: asString(input?.sourceType),
          sourceTag: asString(input?.sourceTag),
        },
        retryMetadata,
      );

      return NextResponse.json({ agentRunId: result.agentRunId, retryCount: retryMetadata.retryCount });
    }
    case 'EAT-TS.OUTREACH': {
      const input = run.inputSnapshot as Record<string, unknown> | null;
      const candidateId = asString(input?.candidateId);
      const jobReqId = asString(input?.jobReqId);

      if (!candidateId || !jobReqId) {
        return NextResponse.json({ error: 'Missing candidateId or jobReqId for retry' }, { status: 400 });
      }

      const result = await runOutreach(
        {
          recruiterId: asString(input?.recruiterId) ?? currentUser.id,
          candidateId,
          jobReqId,
        },
        retryMetadata,
      );

      return NextResponse.json({ agentRunId: result.agentRunId, retryCount: retryMetadata.retryCount });
    }
    default:
      return NextResponse.json({ error: 'Retry not supported for this agent' }, { status: 400 });
  }
}
