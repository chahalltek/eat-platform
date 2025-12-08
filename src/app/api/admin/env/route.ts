import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth/user';
import { getEnvironmentSnapshot } from '@/lib/admin/env';
import { canViewEnvironment } from '@/lib/auth/permissions';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!canViewEnvironment(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const snapshot = getEnvironmentSnapshot();

  return NextResponse.json(snapshot);
}
