import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';

import { DEFAULT_TENANT_ID, TENANT_HEADER, TENANT_QUERY_PARAM } from './auth/config';
import { getSessionClaims } from './auth/session';
import type { AsyncLocalStorage } from 'node:async_hooks';

const isEdgeRuntime = typeof globalThis !== 'undefined' && 'EdgeRuntime' in globalThis;

type TenantContext = {
  run<T>(tenantId: string, callback: () => Promise<T>): Promise<T>;
  getStore(): Promise<string | undefined>;
};

let asyncStoragePromise: Promise<AsyncLocalStorage<string> | null> | null = null;
let fallbackTenantId: string | undefined;

async function getAsyncLocalStorage() {
  if (isEdgeRuntime) {
    return null;
  }

  if (!asyncStoragePromise) {
    asyncStoragePromise = import('node:async_hooks')
      .then(({ AsyncLocalStorage }) => new AsyncLocalStorage<string>())
      .catch(() => null);
  }

  return asyncStoragePromise;
}

const tenantContext: TenantContext = {
  async run<T>(tenantId: string, callback: () => Promise<T>) {
    const storage = await getAsyncLocalStorage();

    if (storage) {
      return storage.run(tenantId, callback);
    }

    const previousTenantId = fallbackTenantId;
    fallbackTenantId = tenantId;

    try {
      return await callback();
    } finally {
      fallbackTenantId = previousTenantId;
    }
  },
  async getStore() {
    const storage = await getAsyncLocalStorage();

    return storage?.getStore() ?? fallbackTenantId;
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
