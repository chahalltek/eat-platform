import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

const findFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst,
    },
  },
}));

describe("POST /api/auth/login", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_PASSWORD = "super-secret";
    delete process.env.AUTH_PASSWORD_LOCAL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const buildRequest = (body: Record<string, unknown>) =>
    new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
      },
      body: JSON.stringify(body),
    });

  it("authenticates with the configured password", async () => {
    findFirst.mockResolvedValue({
      id: "user-123",
      email: "recruiter@test.demo",
      displayName: "Recruiter",
      role: "RECRUITER",
      tenantId: "default-tenant",
    });

    const response = await POST(
      buildRequest({ email: "recruiter@test.demo", password: "super-secret" }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.user).toEqual({
      id: "user-123",
      email: "recruiter@test.demo",
      displayName: "Recruiter",
      role: "RECRUITER",
      tenantId: "default-tenant",
    });
    expect(payload.session).toEqual({
      userId: "user-123",
      tenantId: "default-tenant",
      role: "RECRUITER",
      expiresAt: expect.any(String),
    });
    expect(response.cookies.get("eat_session")?.value).toBeTruthy();
  });

  it("falls back to a default password when none is configured", async () => {
    delete process.env.AUTH_PASSWORD;
    delete process.env.AUTH_PASSWORD_LOCAL;

    findFirst.mockResolvedValue({
      id: "user-123",
      email: "recruiter@test.demo",
      displayName: "Recruiter",
      role: "RECRUITER",
      tenantId: "default-tenant",
    });

    const response = await POST(
      buildRequest({ email: "recruiter@test.demo", password: "password" }),
    );

    expect(response.status).toBe(200);
  });

  it("rejects invalid credentials", async () => {
    findFirst.mockResolvedValue({
      id: "user-123",
      email: "recruiter@test.demo",
      displayName: "Recruiter",
      role: "RECRUITER",
      tenantId: "default-tenant",
    });

    const response = await POST(buildRequest({ email: "recruiter@test.demo", password: "wrong" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Invalid email or password" });
  });
});

describe("GET /api/auth/login", () => {
  it("redirects to the login page", async () => {
    const response = await GET(new NextRequest("http://localhost/api/auth/login"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });
});