import { NextResponse } from 'next/server';

import { clearSessionCookie } from '@/lib/auth/session';

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') ?? '*';

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  } satisfies Record<string, string>;
}

function withCors(request: Request, response: NextResponse) {
  const headers = corsHeaders(request);

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const response = NextResponse.json({ success: true });
  response.cookies.set(clearSessionCookie());

  return withCors(request, response);
}
