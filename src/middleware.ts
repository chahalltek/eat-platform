import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

<<<<<<< ours
import { DEFAULT_TENANT_ID, TENANT_HEADER, USER_HEADER } from './lib/auth/config';
import { getSessionClaims } from './lib/auth/session';
import { consumeRateLimit, isRateLimitError, RATE_LIMIT_ACTIONS } from './lib/rateLimiting/rateLimiter';
import { toRateLimitResponse } from './lib/rateLimiting/http';

const AUTH_EXEMPT_PATHS = ['/api/auth/login', '/api/auth/logout'];
=======
import {
  DEFAULT_TENANT_ID,
  DEFAULT_USER_ID,
  ROLE_HEADER,
  TENANT_HEADER,
  TENANT_QUERY_PARAM,
  USER_HEADER,
  USER_QUERY_PARAM,
} from './lib/auth/config';
import { isAdminRole, normalizeRole, USER_ROLES, type UserRole } from './lib/auth/roles';
import { prisma } from './lib/prisma';
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
>>>>>>> theirs

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const session = getSessionClaims(request);

<<<<<<< ours
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
=======
  if (PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const user = await prisma.user.findUnique({
    where: { id: resolvedUserId },
    select: { id: true, role: true, tenantId: true },
  });

  if (!resolvedUserId || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const queryTenantId = searchParams.get(TENANT_QUERY_PARAM)?.trim();
  const resolvedTenantId = queryTenantId || user.tenantId || DEFAULT_TENANT_ID;

  const normalizedRole = normalizeRole(user.role);

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

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(USER_HEADER, user.id);
  requestHeaders.set(TENANT_HEADER, resolvedTenantId);
  requestHeaders.set(ROLE_HEADER, normalizedRole);
>>>>>>> theirs

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

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set(USER_HEADER, user.id);
  response.headers.set(TENANT_HEADER, resolvedTenantId);
  response.headers.set(ROLE_HEADER, normalizedRole);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
