import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/user';
import { prisma } from '@/server/db';
import { runOutreach } from '@/lib/agents/outreach';
import { runRina } from '@/lib/agents/rina';
import { runRua } from '@/lib/agents/rua';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import {
  enforceFeatureFlag,
  getAgentFeatureName,
} from '@/lib/featureFlags/middleware';
import { DEFAULT_TENANT_ID } from '@/lib/auth/config';

function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

async function buildRetryMetadata(runId: string, tenantId: string, retryOfId?: string) {
  const rootRunId = retryOfId ?? runId;
  const previousRetries = await prisma.agentRunLog.count({ where: { retryOfId: rootRunId, tenantId } });

  return { retryOfId: rootRunId, retryCount: previousRetries + 1 } as const;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser(req);

  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  const tenantId = (currentUser.tenantId ?? DEFAULT_TENANT_ID).trim();

  const run = await prisma.agentRunLog.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      agentName: true,
      inputSnapshot: true,
      retryPayload: true,
      rawResumeText: true,
      retryOfId: true,
    },
  });

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const flagCheck = await enforceFeatureFlag(FEATURE_FLAGS.AGENTS, {
    featureName: getAgentFeatureName(run.agentName),
  });

  if (flagCheck) {
    return flagCheck;
  }

  const retryMetadata = await buildRetryMetadata(run.id, tenantId, run.retryOfId ?? undefined);

  switch (run.agentName) {
    case 'ETE-TS.RINA': {
      const retryPayload = (run.retryPayload ?? run.inputSnapshot) as Record<string, unknown> | null;
      const rawResumeText = asString(run.rawResumeText) ?? asString(retryPayload?.rawResumeText);

      if (!rawResumeText) {
        console.warn('RINA retry failed: missing rawResumeText', { runId: run.id });
        return NextResponse.json(
          {
            errorCode: 'MISSING_RETRY_INPUT',
            message: 'This run cannot be retried because the original resume text is missing. New runs will store this data for retry.',
          },
          { status: 422 },
        );
      }

      const result = await runRina(
        {
          rawResumeText,
          sourceType: asString(retryPayload?.sourceType),
          sourceTag: asString(retryPayload?.sourceTag),
        },
        retryMetadata,
      );

      return NextResponse.json({ agentRunId: result.agentRunId, retryCount: retryMetadata.retryCount });
    }
    case 'ETE-TS.RUA': {
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
    case 'ETE-TS.OUTREACH': {
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
