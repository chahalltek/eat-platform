import { NextRequest, NextResponse } from 'next/server';

import { logFeatureFlagToggle } from '@/lib/audit/adminAudit';
import { getCurrentUser } from '@/lib/auth/user';
import {
  describeFeatureFlag,
  listFeatureFlags,
  parseFeatureFlagName,
  setFeatureFlag,
} from '@/lib/featureFlags';
import { getCurrentTenantId } from '@/lib/tenant';
import { canManageFeatureFlags } from '@/lib/auth/permissions';

async function requireAdmin(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!canManageFeatureFlags(user)) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), user } as const;
  }

  return { response: null, user } as const;
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request);

  if (response) {
    return response;
  }

  const flags = await listFeatureFlags();

  return NextResponse.json(flags);
}

export async function PATCH(request: NextRequest) {
  const { response, user } = await requireAdmin(request);

  if (response) {
    return response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, enabled } = (body ?? {}) as { name?: unknown; enabled?: unknown };
  const parsedName = parseFeatureFlagName(name);

  if (!parsedName || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'name and enabled are required' }, { status: 400 });
  }

  const tenantId = await getCurrentTenantId(request);
  const updatedFlag = await setFeatureFlag(parsedName, enabled, tenantId);

  await logFeatureFlagToggle({
    tenantId,
    actorId: user?.id ?? null,
    flagName: parsedName,
    enabled: updatedFlag.enabled,
  });

  return NextResponse.json({
    ...updatedFlag,
    description: describeFeatureFlag(parsedName),
  });
}
