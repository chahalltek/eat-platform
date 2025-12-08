import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  DEFAULT_TENANT_ID,
  DEFAULT_USER_ID,
  TENANT_HEADER,
  TENANT_QUERY_PARAM,
  USER_HEADER,
  USER_QUERY_PARAM,
} from './lib/auth/config';
import { consumeRateLimit, isRateLimitError, RATE_LIMIT_ACTIONS } from './lib/rateLimiting/rateLimiter';
import { toRateLimitResponse } from './lib/rateLimiting/http';

export async function middleware(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const queryUserId = searchParams.get(USER_QUERY_PARAM)?.trim();
  const resolvedUserId = queryUserId || DEFAULT_USER_ID;

  if (!resolvedUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const queryTenantId = searchParams.get(TENANT_QUERY_PARAM)?.trim();
  const resolvedTenantId = queryTenantId || DEFAULT_TENANT_ID;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(USER_HEADER, resolvedUserId);
  requestHeaders.set(TENANT_HEADER, resolvedTenantId);

  try {
    if (request.nextUrl.pathname.startsWith('/api')) {
      await consumeRateLimit({
        tenantId: resolvedTenantId,
        userId: resolvedUserId,
        action: RATE_LIMIT_ACTIONS.API,
      });
    }
  } catch (error) {
    if (isRateLimitError(error)) {
      return toRateLimitResponse(error);
    }

    throw error;
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
