import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth/user';
import { getEnvironmentSnapshot } from '@/lib/admin/env';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const snapshot = getEnvironmentSnapshot();

  return NextResponse.json(snapshot);
}
