import { NextResponse } from 'next/server';

import { getSystemStatus } from '@/lib/systemStatus';
import { getRedactedSystemStatus, isPublicDemoMode } from '@/lib/demoMode';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    if (isPublicDemoMode()) {
      return NextResponse.json(getRedactedSystemStatus());
    }

    const status = await getSystemStatus();

    return NextResponse.json(status);
  } catch (error) {
    console.error('[system-status] Failed to compute status', error);

    return NextResponse.json(getRedactedSystemStatus(), { status: 200 });
  }
}
