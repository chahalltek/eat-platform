import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { DEFAULT_TENANT_ID, TENANT_HEADER, USER_HEADER } from './lib/auth/config';
import { getSessionClaims } from './lib/auth/session';
import { consumeRateLimit, isRateLimitError, RATE_LIMIT_ACTIONS } from './lib/rateLimiting/rateLimiter';
import { toRateLimitResponse } from './lib/rateLimiting/http';

const AUTH_EXEMPT_PATHS = ['/api/auth/login', '/api/auth/logout'];

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const session = getSessionClaims(request);

  if (session) {
    requestHeaders.set(USER_HEADER, session.userId);
    requestHeaders.set(TENANT_HEADER, session.tenantId ?? DEFAULT_TENANT_ID);
  }

  const isApiRoute = request.nextUrl.pathname.startsWith('/api');
  const isAuthRoute = AUTH_EXEMPT_PATHS.includes(request.nextUrl.pathname);

  if (isApiRoute && !isAuthRoute) {
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      await consumeRateLimit({
        tenantId: session.tenantId ?? DEFAULT_TENANT_ID,
        userId: session.userId,
        action: RATE_LIMIT_ACTIONS.API,
      });
    } catch (error) {
      if (isRateLimitError(error)) {
        return toRateLimitResponse(error);
      }

      throw error;
    }
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
