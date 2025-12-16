import type { NextRequest } from 'next/server';

import { DEFAULT_TENANT_ID, TENANT_HEADER, TENANT_QUERY_PARAM } from './auth/config';
import { getSessionClaims } from './auth/session';
type TenantContext = {
  run<T>(tenantId: string, callback: () => Promise<T>): Promise<T>;
  getStore(): Promise<string | undefined>;
};
let fallbackTenantId: string | undefined;

const tenantContext: TenantContext = {
  async run<T>(tenantId: string, callback: () => Promise<T>) {
    const previousTenantId = fallbackTenantId;
    fallbackTenantId = tenantId;

    try {
      return await callback();
    } finally {
      fallbackTenantId = previousTenantId;
    }
  },
  async getStore() {
    return fallbackTenantId;
  },
};

async function extractTenantIdFromRequest(req: NextRequest) {
  const sessionTenant = (await getSessionClaims(req))?.tenantId;
  if (sessionTenant && sessionTenant.trim()) {
    return sessionTenant.trim();
  }

  const queryValue = req.nextUrl.searchParams.get(TENANT_QUERY_PARAM);

  if (queryValue && queryValue.trim()) {
    return queryValue.trim();
  }

  const headerValue = req.headers.get(TENANT_HEADER);

  if (headerValue && headerValue.trim()) {
    return headerValue.trim();
  }

  return null;
}

async function extractTenantIdFromHeaders() {
  try {
    const sessionTenant = (await getSessionClaims())?.tenantId;
    if (sessionTenant && sessionTenant.trim()) {
      return sessionTenant.trim();
    }

    if (typeof window !== 'undefined') {
      return null;
    }

    const { headers } = await import('next/headers');
    const headerList = await headers();
    const headerValue = headerList.get(TENANT_HEADER);

    if (headerValue && headerValue.trim()) {
      return headerValue.trim();
    }
  } catch (error) {
    // Outside of a request context, fall back to the default tenant.
  }

  return null;
}

export function withTenantContext<T>(tenantId: string, callback: () => Promise<T>) {
  return tenantContext.run(tenantId, callback);
}

export async function getCurrentTenantId(req?: NextRequest) {
  const tenantIdFromContext = await tenantContext.getStore();

  if (tenantIdFromContext) {
    return tenantIdFromContext;
  }

  const tenantId = (req ? await extractTenantIdFromRequest(req) : await extractTenantIdFromHeaders()) ?? DEFAULT_TENANT_ID;

  return tenantId;
}

export function getTenantFromParamsOrSession(
  paramsTenantId: string | null | undefined,
  sessionTenantId: string | null | undefined,
) {
  const normalizedParamsTenantId = paramsTenantId?.trim?.();

  if (normalizedParamsTenantId) {
    return normalizedParamsTenantId;
  }

  const normalizedSessionTenantId = sessionTenantId?.trim?.();

  if (normalizedSessionTenantId) {
    return normalizedSessionTenantId;
  }

  return DEFAULT_TENANT_ID;
}
