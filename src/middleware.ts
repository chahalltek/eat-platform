import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  DEFAULT_TENANT_ID,
  DEFAULT_USER_ID,
  PERMISSIONS_HEADER,
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
  '/visual/status-badges',
  '/maintenance',
  '/api/tenant/mode',
];
const ASSET_PATH_PATTERN = /\.(png|svg|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$/i;
const ADMIN_PATH_PREFIXES = ['/admin', '/api/admin'];
const RECRUITER_PATH_PREFIXES = ['/candidates', '/jobs', '/agents', '/dashboard', '/api', '/ete/jobs', '/fulfillment'];
const HIRING_MANAGER_PATH_PREFIXES = ['/ete/hiring-manager'];
const EXEC_PATH_PREFIXES = ['/exec'];
const LEGACY_PATH_PREFIXES = [
  { from: '/api/admin/eat', to: '/api/admin/ete' },
  { from: '/api/eat', to: '/api/ete' },
  { from: '/admin/eat', to: '/admin/ete' },
  { from: '/eat', to: '/ete' },
];
const ADMIN_OR_DATA_ACCESS_ROLES = new Set<UserRole>([
  USER_ROLES.ADMIN,
  USER_ROLES.SYSTEM_ADMIN,
  USER_ROLES.TENANT_ADMIN,
  USER_ROLES.DATA_ACCESS,
]);
const RECRUITER_ROLES = new Set<UserRole>([
  USER_ROLES.ADMIN,
  USER_ROLES.RECRUITER,
  USER_ROLES.SOURCER,
  USER_ROLES.FULFILLMENT_RECRUITER,
  USER_ROLES.FULFILLMENT_SOURCER,
  USER_ROLES.FULFILLMENT_MANAGER,
  USER_ROLES.SALES,
  USER_ROLES.TENANT_ADMIN,
  USER_ROLES.SYSTEM_ADMIN,
]);
const HIRING_MANAGER_ROLES = new Set<UserRole>([
  USER_ROLES.ADMIN,
  USER_ROLES.SYSTEM_ADMIN,
  USER_ROLES.TENANT_ADMIN,
  USER_ROLES.MANAGER,
]);
const EXEC_ROLES = new Set<UserRole>([
  USER_ROLES.ADMIN,
  USER_ROLES.EXEC,
  USER_ROLES.TENANT_ADMIN,
  USER_ROLES.SYSTEM_ADMIN,
]);

const ADMIN_TENANT_PATH_PATTERNS = [
  /^\/api\/admin\/tenant\/([^/]+)/,
  /^\/api\/admin\/tenants\/([^/]+)/,
  /^\/admin\/tenant\/([^/]+)/,
  /^\/admin\/tenants\/([^/]+)/,
];

function extractTenantIdFromPath(path: string) {
  for (const pattern of ADMIN_TENANT_PATH_PATTERNS) {
    const match = path.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function buildLoginRedirect(request: NextRequest) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  loginUrl.search = loginUrl.searchParams.toString();

  return loginUrl;
}

async function fetchTenantMode(request: NextRequest, tenantId: string) {
  const url = new URL('/api/tenant/mode', request.url);
  url.searchParams.set('tenantId', tenantId);

  const response = await fetch(url, {
    headers: { [TENANT_HEADER]: tenantId },
    cache: 'no-store',
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as { mode?: string } | null;

  return payload?.mode ?? null;
}

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const { session, error: sessionError } = await getValidatedSession(request);
  const searchParams = request.nextUrl.searchParams;
  const requestPath = request.nextUrl.pathname;
  const headerUserId = request.headers.get(USER_HEADER)?.trim();
  const headerRole = request.headers.get(ROLE_HEADER)?.trim();
  const headerTenantId = request.headers.get(TENANT_HEADER)?.trim();

  if (ASSET_PATH_PATTERN.test(requestPath)) {
    return NextResponse.next();
  }

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
  const pathTenantId = extractTenantIdFromPath(requestPath);
  const sessionTenantId = session?.tenantId?.trim();
  const resolvedPermissions = Array.isArray(session?.permissions)
    ? session.permissions
        .filter(Boolean)
        .map((permission) => (permission ? permission.toLowerCase().trim() : ""))
        .filter(Boolean)
    : [];

  const normalizedRole = normalizeRole(session?.role ?? headerRole ?? DEFAULT_USER_ROLE);

  const isGlobalAdmin =
    normalizedRole === USER_ROLES.ADMIN || normalizedRole === USER_ROLES.SYSTEM_ADMIN;
  const resolvedTenantId =
    (isGlobalAdmin && (pathTenantId || queryTenantId || headerTenantId)) ||
    sessionTenantId ||
    pathTenantId ||
    queryTenantId ||
    headerTenantId ||
    DEFAULT_TENANT_ID;

  if (!normalizedRole) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const shouldBypassMaintenance =
    isAdminRole(normalizedRole) ||
    requestPath.startsWith('/admin') ||
    requestPath.startsWith('/api/admin') ||
    requestPath.startsWith('/api/auth') ||
    requestPath.startsWith('/api/health') ||
    requestPath.startsWith('/api/tenant/mode') ||
    requestPath.startsWith('/maintenance') ||
    requestPath.startsWith('/health') ||
    requestPath.startsWith('/login');

  if (!shouldBypassMaintenance) {
    const tenantMode = await fetchTenantMode(request, resolvedTenantId);

    if (tenantMode === 'maintenance') {
      if (requestPath.startsWith('/api')) {
        return NextResponse.json({ error: 'Maintenance mode active' }, { status: 503 });
      }

      const maintenanceUrl = request.nextUrl.clone();
      maintenanceUrl.pathname = '/maintenance';
      maintenanceUrl.search = '';
      return NextResponse.redirect(maintenanceUrl);
    }
  }

  const isAdminPath = ADMIN_PATH_PREFIXES.some((path) => requestPath.startsWith(path));
  const isHiringManagerPath = HIRING_MANAGER_PATH_PREFIXES.some((path) => requestPath.startsWith(path));
  const isRecruiterPath = RECRUITER_PATH_PREFIXES.some((path) => requestPath.startsWith(path));
  const isExecPath = EXEC_PATH_PREFIXES.some((path) => requestPath.startsWith(path));

  if (isAdminPath && !ADMIN_OR_DATA_ACCESS_ROLES.has(normalizedRole)) {
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

  if (isExecPath && !EXEC_ROLES.has(normalizedRole)) {
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
  requestHeaders.set(PERMISSIONS_HEADER, resolvedPermissions.join(","));

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
  response.headers.set(PERMISSIONS_HEADER, resolvedPermissions.join(","));

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
