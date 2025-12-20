import http from "node:http";
import https from "node:https";

import { afterEach } from "vitest";

import { mockDb } from "@/test-helpers/db";

const NETWORK_ERROR_MESSAGE =
  "[network-blocked] Outbound network requests are disabled in tests. Provide a mock instead.";

const SAFE_ENV_DEFAULTS: Record<string, string> = {
  NODE_ENV: "test",
  APP_ENV: "test",
  DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test",
  POSTGRES_PRISMA_URL: "postgresql://test:test@127.0.0.1:5432/test",
  POSTGRES_URL_NON_POOLING: "postgresql://test:test@127.0.0.1:5432/test",
  POSTGRES_URL: "postgresql://test:test@127.0.0.1:5432/test",
  OPENAI_API_KEY: "test-openai-key",
  SSO_ISSUER_URL: "https://sso.example.com",
  SSO_CLIENT_ID: "test-client",
  SSO_CLIENT_SECRET: "test-secret",
  BILLING_PROVIDER_SECRET_KEY: "sk_test_placeholder",
  BILLING_WEBHOOK_SECRET: "whsec_test_placeholder",
  TENANT_MODE: "multi",
  AUTH_PASSWORD_LOCAL: "test-password",
  AUTH_SESSION_SECRET_LOCAL: "test-session-secret",
};

function applySafeEnvDefaults(env: NodeJS.ProcessEnv) {
  for (const [key, value] of Object.entries(SAFE_ENV_DEFAULTS)) {
    if (!env[key]) {
      env[key] = value;
    }
  }
}

function describeTarget(target: unknown) {
  if (typeof target === "string") return target;
  if (target instanceof URL) return target.toString();

  if (target && typeof target === "object") {
    const maybeUrl = (target as { href?: string; url?: string }).href ?? (target as { href?: string; url?: string }).url;
    if (maybeUrl) return maybeUrl;

    const host = (target as { host?: string; hostname?: string }).host ?? (target as { host?: string; hostname?: string }).hostname;
    const port = (target as { port?: string }).port;
    const path = (target as { path?: string; pathname?: string }).path ?? (target as { path?: string; pathname?: string }).pathname;

    if (host || path) {
      return `${host ?? "unknown-host"}${port ? `:${port}` : ""}${path ?? ""}`;
    }
  }

  return "unknown target";
}

function throwNetworkError(origin: string, target: unknown) {
  const description = describeTarget(target);
  throw new Error(`${NETWORK_ERROR_MESSAGE} Attempted ${origin}${description ? ` to ${description}` : ""}.`);
}

function blockNetworkRequests() {
  const realFetch = globalThis.fetch;
  const realHttpRequest = http.request;
  const realHttpGet = http.get;
  const realHttpsRequest = https.request;
  const realHttpsGet = https.get;

  const allowLocalhost = (target: unknown) => {
    const description = describeTarget(target);
    return (
      description.startsWith("http://127.0.0.1") ||
      description.startsWith("http://localhost") ||
      description.startsWith("https://127.0.0.1") ||
      description.startsWith("https://localhost")
    );
  };

  const blockFetch = ((...args: unknown[]) => {
    if (allowLocalhost(args[0])) {
      // @ts-expect-error - allow passthrough to the built-in fetch for local test servers.
      return realFetch(args[0] as RequestInfo, args[1] as RequestInit | undefined);
    }
    throwNetworkError("fetch", args[0]);
  }) as typeof fetch;

  // @ts-expect-error - overriding global fetch to enforce test safety.
  globalThis.fetch = blockFetch;

  const blockHttpRequest = ((...args: unknown[]) => {
    if (allowLocalhost(args[0])) {
      // @ts-expect-error - allow passthrough to built-in request for localhost test servers.
      return realHttpRequest(args[0] as never, args[1] as never, args[2] as never);
    }
    throwNetworkError("http.request", args[0]);
  }) as unknown as typeof http.request;

  const blockHttpGet = ((...args: unknown[]) => {
    if (allowLocalhost(args[0])) {
      // @ts-expect-error - allow passthrough to built-in get for localhost test servers.
      return realHttpGet(args[0] as never, args[1] as never, args[2] as never);
    }
    throwNetworkError("http.get", args[0]);
  }) as unknown as typeof http.get;

  const blockHttpsRequest = ((...args: unknown[]) => {
    if (allowLocalhost(args[0])) {
      // @ts-expect-error - allow passthrough to built-in request for localhost test servers.
      return realHttpsRequest(args[0] as never, args[1] as never, args[2] as never);
    }
    throwNetworkError("https.request", args[0]);
  }) as unknown as typeof https.request;

  const blockHttpsGet = ((...args: unknown[]) => {
    if (allowLocalhost(args[0])) {
      // @ts-expect-error - allow passthrough to built-in get for localhost test servers.
      return realHttpsGet(args[0] as never, args[1] as never, args[2] as never);
    }
    throwNetworkError("https.get", args[0]);
  }) as unknown as typeof https.get;

  http.request = blockHttpRequest;
  http.get = blockHttpGet;
  https.request = blockHttpsRequest;
  https.get = blockHttpsGet;
}

applySafeEnvDefaults(process.env);

// Register Prisma mocks globally for all test suites.
const { resetDbMocks } = mockDb();

blockNetworkRequests();

afterEach(() => {
  resetDbMocks();
});
