import { NextResponse } from 'next/server';

import { getSystemStatus } from '@/lib/systemStatus';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const status = await getSystemStatus();

    return NextResponse.json(status);
  } catch (error) {
    console.error('[system-status] Failed to compute status', error);

    return NextResponse.json(
      {
        agents: { status: 'unknown' },
        scoring: { status: 'unknown' },
        database: { status: 'unknown' },
        tenantConfig: { status: 'unknown' },
      },
      { status: 200 },
    );
  }
}
