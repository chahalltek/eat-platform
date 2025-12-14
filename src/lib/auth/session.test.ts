import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

import { clearSessionCookie, createSessionCookie, getSessionClaims, parseSessionToken } from "./session";

// Mock crypto.subtle for deterministic signatures
const subtleMock = {
  importKey: vi.fn(async (_format, keyData) => ({ keyData })),
  sign: vi.fn(async (_algo, key, data) => {
    // simple deterministic signature for testing
    const combined = `${new TextDecoder().decode(key.keyData)}:${new TextDecoder().decode(data)}`;
    return new TextEncoder().encode(combined);
  }),
  verify: vi.fn(async (_algo, key, signature, data) => {
    const combined = `${new TextDecoder().decode(key.keyData)}:${new TextDecoder().decode(data)}`;
    return combined === new TextDecoder().decode(signature);
  }),
};

function base64UrlEncode(data: Uint8Array) {
  const binary = String.fromCharCode(...data);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

describe("session tokens", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { subtle: subtleMock } as unknown as Crypto);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.useFakeTimers();
    process.env.AUTH_SESSION_SECRET = "test-secret";
    process.env.AUTH_SESSION_SECRET_LOCAL = "local-secret";
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns null for malformed tokens instead of throwing", async () => {
    const result = await parseSessionToken("not-a-token");

    expect(result).toBeNull();
  });

  it("parses a valid session token", async () => {
    const cookie = await createSessionCookie({ id: "user-1" });

    const claims = await parseSessionToken(cookie.value);

    expect(claims?.userId).toBe("user-1");
  });

  it("returns null for expired tokens", async () => {
    const cookie = await createSessionCookie({ id: "user-2" });

    vi.setSystemTime(new Date(Date.now() + 1000 * 60 * 60 * 24 * 8));

    const claims = await parseSessionToken(cookie.value);

    expect(claims).toBeNull();
  });

  it("rejects tampered signatures", async () => {
    const cookie = await createSessionCookie({ id: "user-3" });

    const tampered = `${cookie.value}extra`;
    const claims = await parseSessionToken(tampered);

    expect(claims).toBeNull();
  });

  it("returns null when the payload cannot be decoded", async () => {
    const payload = "%%%";
    const key = await subtleMock.importKey("raw", new TextEncoder().encode("test-secret"));
    const signatureBytes = await subtleMock.sign("HMAC", key, new TextEncoder().encode(payload));
    const signature = base64UrlEncode(signatureBytes as Uint8Array);

    const claims = await parseSessionToken(`${payload}.${signature}`);

    expect(claims).toBeNull();
  });

  it("logs and returns null when signature decoding fails", async () => {
    const claims = await parseSessionToken("header.invalid$$$signature");

    expect(claims).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it("uses the local session secret in production when no explicit secret is set", async () => {
    delete process.env.AUTH_SESSION_SECRET;
    process.env.NODE_ENV = "production";

    const cookie = await createSessionCookie({ id: "user-4" });
    const claims = await parseSessionToken(cookie.value);

    expect(claims?.userId).toBe("user-4");
  });

  it("falls back to the development secret when no secrets are configured", async () => {
    delete process.env.AUTH_SESSION_SECRET;
    delete process.env.AUTH_SESSION_SECRET_LOCAL;
    process.env.NODE_ENV = "development";

    const cookie = await createSessionCookie({ id: "user-5" });
    const claims = await parseSessionToken(cookie.value);

    expect(claims?.userId).toBe("user-5");
  });

  it("uses the default development secret when running in production without overrides", async () => {
    vi.resetModules();
    vi.stubGlobal("crypto", { subtle: subtleMock } as unknown as Crypto);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    delete process.env.AUTH_SESSION_SECRET;
    delete process.env.AUTH_SESSION_SECRET_LOCAL;
    process.env.NODE_ENV = "production";

    const sessionModule = await import("./session");
    const cookie = await sessionModule.createSessionCookie({ id: "user-8" });
    const claims = await sessionModule.parseSessionToken(cookie.value);

    expect(claims?.userId).toBe("user-8");
  });

  it("parses session claims from a request cookie", async () => {
    const cookie = await createSessionCookie({ id: "user-6", tenantId: "tenant-x" });
    const request = new NextRequest("https://example.com/dashboard", {
      headers: { cookie: `${cookie.name}=${cookie.value}` },
    });

    const claims = await getSessionClaims(request);

    expect(claims?.userId).toBe("user-6");
    expect(claims?.tenantId).toBe("tenant-x");
  });

  it("swallows cookie store errors when resolving session claims without a request", async () => {
    vi.resetModules();
    vi.stubGlobal("crypto", { subtle: subtleMock } as unknown as Crypto);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.useFakeTimers();
    process.env.AUTH_SESSION_SECRET = "";
    process.env.AUTH_SESSION_SECRET_LOCAL = "";

    vi.doMock("next/headers", () => ({
      cookies: vi.fn(async () => {
        throw new Error("cookies unavailable");
      }),
    }));

    const { getSessionClaims: mockedGetSessionClaims } = await import("./session");
    const claims = await mockedGetSessionClaims();

    expect(claims).toBeNull();
  });

  it("reads the session cookie from the request cookie store when available", async () => {
    vi.resetModules();
    vi.stubGlobal("crypto", { subtle: subtleMock } as unknown as Crypto);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.AUTH_SESSION_SECRET = "test-secret";
    process.env.AUTH_SESSION_SECRET_LOCAL = "local-secret";

    let storedToken = "";

    vi.doMock("next/headers", () => ({
      cookies: vi.fn(async () => ({
        get: () => (storedToken ? { value: storedToken } : undefined),
      })),
    }));

    const sessionModule = await import("./session");
    const cookie = await sessionModule.createSessionCookie({ id: "user-7", tenantId: "tenant-y" });
    storedToken = cookie.value;

    const claims = await sessionModule.getSessionClaims();

    expect(claims?.userId).toBe("user-7");
    expect(claims?.tenantId).toBe("tenant-y");
  });

  it("sets a shared domain when configured", async () => {
    process.env.AUTH_COOKIE_DOMAIN = "auth.example.com";

    const cookie = await createSessionCookie({ id: "user-9" });
    const clearingCookie = clearSessionCookie();

    expect(cookie.domain).toBe(".auth.example.com");
    expect(clearingCookie.domain).toBe(".auth.example.com");

    delete process.env.AUTH_COOKIE_DOMAIN;
  });

  it("returns a clearing cookie definition", () => {
    const cookie = clearSessionCookie();

    expect(cookie.value).toBe("");
    expect(cookie.maxAge).toBe(0);
  });
});
