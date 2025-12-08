import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { DEFAULT_USER_ID, USER_HEADER, USER_QUERY_PARAM } from './lib/auth/config';

export function middleware(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const queryUserId = searchParams.get(USER_QUERY_PARAM)?.trim();
  const resolvedUserId = queryUserId || DEFAULT_USER_ID;

  if (!resolvedUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(USER_HEADER, resolvedUserId);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
