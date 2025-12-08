import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';

import { DEFAULT_TENANT_ID, TENANT_HEADER, TENANT_QUERY_PARAM } from './auth/config';

function extractTenantIdFromRequest(req: NextRequest) {
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

export async function getCurrentTenantId(req?: NextRequest) {
  const tenantId = (req ? extractTenantIdFromRequest(req) : await extractTenantIdFromHeaders()) ?? DEFAULT_TENANT_ID;

  return tenantId;
}
