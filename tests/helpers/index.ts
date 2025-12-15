import { NextRequest } from "next/server";
import { vi } from "vitest";

import type { IdentityUser } from "@/lib/auth/types";
import type { prismaMockInstance } from "@/test-helpers/db";
import { prismaMockInstance as prisma, resetDbMocks } from "@/test-helpers/db";

export type MakeNextRequestOptions = {
  method?: string;
  url: string;
  json?: unknown;
  body?: BodyInit | null;
  headers?: HeadersInit;
  query?: Record<string, string | number | boolean | null | undefined>;
};

export function makeNextRequest({
  method = "GET",
  url: rawUrl,
  json,
  body,
  headers,
  query,
}: MakeNextRequestOptions): NextRequest {
  const url = new URL(rawUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }

  const requestHeaders = new Headers(headers);
  let requestBody = body ?? null;

  if (json !== undefined) {
    requestBody = JSON.stringify(json);
    if (!requestHeaders.has("content-type")) {
      requestHeaders.set("content-type", "application/json");
    }
  }

  const baseRequest = new Request(url.toString(), {
    method,
    headers: requestHeaders,
    body: requestBody,
  });

  return new NextRequest(baseRequest);
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function mockGetCurrentUser(defaultUser: IdentityUser | null = {
  id: "user-1",
  email: null,
  displayName: null,
  role: null,
  tenantId: null,
}) {
  const fn = vi.fn<() => Promise<IdentityUser | null>>();
  fn.mockResolvedValue(defaultUser);
  return fn;
}

export type MockTenantContext = {
  prisma: typeof prismaMockInstance;
  tenantId: string;
  runWithTenantContext: ReturnType<typeof vi.fn>;
};

export function mockTenantContext({ tenantId = "tenant-1" } = {}): MockTenantContext {
  return {
    prisma,
    tenantId,
    runWithTenantContext: vi.fn(async <T>(callback: () => Promise<T>) => callback()),
  };
}

export function mockGetCurrentTenantContext({ tenantId = "tenant-1" } = {}) {
  const context = mockTenantContext({ tenantId });
  const getter = vi.fn(async () => context);
  return Object.assign(getter, { context });
}

export { prisma, resetDbMocks };
