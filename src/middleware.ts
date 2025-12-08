import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  DEFAULT_TENANT_ID,
  DEFAULT_USER_ID,
  DEFAULT_USER_ROLE,
  ROLE_HEADER,
  TENANT_HEADER,
  TENANT_QUERY_PARAM,
  USER_HEADER,
  USER_QUERY_PARAM,
} from './lib/auth/config';
import { isAdminRole, normalizeRole, USER_ROLES, type UserRole } from './lib/auth/roles';
import { getSessionClaims } from './lib/auth/session';
import { consumeRateLimit, isRateLimitError, RATE_LIMIT_ACTIONS } from './lib/rateLimiting/rateLimiter';
import { toRateLimitResponse } from './lib/rateLimiting/http';

const PUBLIC_PATHS = ['/health', '/api/health', '/api/ats/bullhorn/webhook'];
const ADMIN_PATH_PREFIXES = ['/admin', '/api/admin'];
const RECRUITER_PATH_PREFIXES = ['/candidates', '/jobs', '/agents', '/dashboard', '/api'];
const RECRUITER_ROLES = new Set<UserRole>([
  USER_ROLES.ADMIN,
  USER_ROLES.RECRUITER,
  USER_ROLES.MANAGER,
  USER_ROLES.SOURCER,
  USER_ROLES.SALES,
  USER_ROLES.SYSTEM_ADMIN,
]);

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const session = await getSessionClaims(request);
  const searchParams = request.nextUrl.searchParams;

  if (PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const queryUserId = searchParams.get(USER_QUERY_PARAM)?.trim();
  const resolvedUserId = queryUserId || session?.userId || DEFAULT_USER_ID;

  const queryTenantId = searchParams.get(TENANT_QUERY_PARAM)?.trim();
  const resolvedTenantId = queryTenantId || session?.tenantId || DEFAULT_TENANT_ID;

  const normalizedRole = normalizeRole(session?.role ?? DEFAULT_USER_ROLE);

  if (!normalizedRole) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestPath = request.nextUrl.pathname;
  const isAdminPath = ADMIN_PATH_PREFIXES.some((path) => requestPath.startsWith(path));
  const isRecruiterPath = RECRUITER_PATH_PREFIXES.some((path) => requestPath.startsWith(path));

  if (isAdminPath && !isAdminRole(normalizedRole)) {
    const body = requestPath.startsWith('/api')
      ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      : NextResponse.redirect(new URL('/', request.url));

    return body;
  }

  if (isRecruiterPath && !RECRUITER_ROLES.has(normalizedRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  requestHeaders.set(USER_HEADER, resolvedUserId);
  requestHeaders.set(TENANT_HEADER, resolvedTenantId);
  requestHeaders.set(ROLE_HEADER, normalizedRole);

  if (requestPath.startsWith('/api')) {
    try {
      await consumeRateLimit({
        tenantId: resolvedTenantId,
        userId: resolvedUserId,
        action: RATE_LIMIT_ACTIONS.API,
      });
    } catch (error) {
      if (isRateLimitError(error)) {
        return toRateLimitResponse(error);
      }

      throw error;
    }
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set(USER_HEADER, resolvedUserId);
  response.headers.set(TENANT_HEADER, resolvedTenantId);
  response.headers.set(ROLE_HEADER, normalizedRole);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
