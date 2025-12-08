import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSessionCookie,
  getSessionClaims,
  parseSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from "./session";

const { cookiesMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.useFakeTimers();

describe("session helpers", () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.resetAllMocks();
  });

  it("creates a signed session that can be parsed", () => {
    const cookie = createSessionCookie({
      id: "user-123",
      email: "test@example.com",
      displayName: "Test User",
      role: "ADMIN",
      tenantId: "tenant-xyz",
    });

    const payload = parseSessionToken(cookie.value);
    expect(cookie.name).toBe(SESSION_COOKIE_NAME);
    expect(payload?.userId).toBe("user-123");
    expect(payload?.tenantId).toBe("tenant-xyz");
    expect(payload?.email).toBe("test@example.com");
  });

  it("rejects expired sessions", () => {
    const cookie = createSessionCookie({ id: "user-123" });

    const payload = parseSessionToken(cookie.value);
    expect(payload?.userId).toBe("user-123");

    vi.advanceTimersByTime((SESSION_DURATION_SECONDS + 1) * 1000);

    expect(parseSessionToken(cookie.value)).toBeNull();
  });

  it("reads the session from mocked cookies when no request is provided", () => {
    const cookie = createSessionCookie({ id: "user-cookie" });
    cookiesMock.mockReturnValue({
      get: (name: string) => (name === SESSION_COOKIE_NAME ? { value: cookie.value } : undefined),
    });

    expect(getSessionClaims()).toMatchObject({ userId: "user-cookie" });
  });
});
