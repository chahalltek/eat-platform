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
import { clearSessionCookie, getValidatedSession } from './lib/auth/session';
import { isDemoMutationAllowed, isPublicDemoMode, isReadOnlyHttpMethod } from './lib/demoMode';
import { consumeRateLimit, isRateLimitError, RATE_LIMIT_ACTIONS } from './lib/rateLimiting/rateLimiter';
import { toRateLimitResponse } from './lib/rateLimiting/http';

const PUBLIC_PATHS = [
  '/health',
  '/api/health',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/ats/bullhorn/webhook',
  '/login',
];
const ADMIN_PATH_PREFIXES = ['/admin', '/api/admin'];
const RECRUITER_PATH_PREFIXES = ['/candidates', '/jobs', '/agents', '/dashboard', '/api', '/ete/jobs'];
const HIRING_MANAGER_PATH_PREFIXES = ['/ete/hiring-manager'];
const LEGACY_PATH_PREFIXES = [
  { from: '/api/admin/eat', to: '/api/admin/ete' },
  { from: '/api/eat', to: '/api/ete' },
  { from: '/admin/eat', to: '/admin/ete' },
  { from: '/eat', to: '/ete' },
];
const RECRUITER_ROLES = new Set<UserRole>([
  USER_ROLES.ADMIN,
  USER_ROLES.RECRUITER,
  USER_ROLES.SOURCER,
  USER_ROLES.SALES,
  USER_ROLES.SYSTEM_ADMIN,
]);
const HIRING_MANAGER_ROLES = new Set<UserRole>([USER_ROLES.ADMIN, USER_ROLES.SYSTEM_ADMIN, USER_ROLES.MANAGER]);

function buildLoginRedirect(request: NextRequest) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  loginUrl.search = loginUrl.searchParams.toString();

  return loginUrl;
}

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const { session, error: sessionError } = await getValidatedSession(request);
  const searchParams = request.nextUrl.searchParams;
  const requestPath = request.nextUrl.pathname;
  const headerUserId = request.headers.get(USER_HEADER)?.trim();
  const headerRole = request.headers.get(ROLE_HEADER)?.trim();
  const headerTenantId = request.headers.get(TENANT_HEADER)?.trim();

  if (
    isPublicDemoMode() &&
    requestPath.startsWith('/api') &&
    !isReadOnlyHttpMethod(request.method) &&
    !isDemoMutationAllowed(requestPath)
  ) {
    return NextResponse.json({ error: 'Read-only demo mode: changes are disabled' }, { status: 403 });
  }

  const legacyPrefix = LEGACY_PATH_PREFIXES.find(
    ({ from }) => requestPath === from || requestPath.startsWith(`${from}/`),
  );

  if (legacyPrefix) {
    const url = request.nextUrl.clone();
    url.pathname = requestPath.replace(legacyPrefix.from, legacyPrefix.to);
    return NextResponse.redirect(url);
  }

  if (PUBLIC_PATHS.some((path) => requestPath.startsWith(path))) {
    return NextResponse.next();
  }

  if (sessionError === 'invalid' || sessionError === 'expired') {
    const errorMessage = sessionError === 'expired' ? 'Session expired' : 'Invalid session';
    const response = requestPath.startsWith('/api')
      ? NextResponse.json({ error: errorMessage }, { status: 401 })
      : NextResponse.redirect(buildLoginRedirect(request));

    response.cookies.set(clearSessionCookie());
    return response;
  }

  if (!session && !headerUserId) {
    if (requestPath.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.redirect(buildLoginRedirect(request));
  }

  const queryUserId = searchParams.get(USER_QUERY_PARAM)?.trim();
  const resolvedUserId = queryUserId || session?.userId || headerUserId || DEFAULT_USER_ID;

  const queryTenantId = searchParams.get(TENANT_QUERY_PARAM)?.trim();
  const resolvedTenantId =
    session?.tenantId || queryTenantId || headerTenantId || DEFAULT_TENANT_ID;

  const normalizedRole = normalizeRole(session?.role ?? headerRole ?? DEFAULT_USER_ROLE);

  if (!normalizedRole) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdminPath = ADMIN_PATH_PREFIXES.some((path) => requestPath.startsWith(path));
  const isHiringManagerPath = HIRING_MANAGER_PATH_PREFIXES.some((path) => requestPath.startsWith(path));
  const isRecruiterPath = RECRUITER_PATH_PREFIXES.some((path) => requestPath.startsWith(path));

  if (isAdminPath && !isAdminRole(normalizedRole)) {
    const body = requestPath.startsWith('/api')
      ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      : NextResponse.redirect(new URL('/', request.url));

    return body;
  }

  if (isHiringManagerPath && !HIRING_MANAGER_ROLES.has(normalizedRole)) {
    const body = requestPath.startsWith('/api')
      ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      : NextResponse.redirect(new URL('/', request.url));

    return body;
  }

  if (isRecruiterPath && !RECRUITER_ROLES.has(normalizedRole)) {
    const body = requestPath.startsWith('/api')
      ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      : NextResponse.redirect(new URL('/', request.url));

    return body;
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
