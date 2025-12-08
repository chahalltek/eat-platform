import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/user';
import {
  describeFeatureFlag,
  listFeatureFlags,
  parseFeatureFlagName,
  setFeatureFlag,
} from '@/lib/featureFlags';

function isAdmin(user: { role: string | null } | null) {
  return (user?.role ?? '').toUpperCase() === 'ADMIN';
}

async function requireAdmin(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return null;
}

export async function GET(request: NextRequest) {
  const guardResponse = await requireAdmin(request);

  if (guardResponse) {
    return guardResponse;
  }

  const flags = await listFeatureFlags();

  return NextResponse.json(flags);
}

export async function PATCH(request: NextRequest) {
  const guardResponse = await requireAdmin(request);

  if (guardResponse) {
    return guardResponse;
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

  const updatedFlag = await setFeatureFlag(parsedName, enabled);

  return NextResponse.json({
    ...updatedFlag,
    description: describeFeatureFlag(parsedName),
  });
}
