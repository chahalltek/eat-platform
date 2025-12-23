import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeRequest } from "@tests/test-utils/routeHarness";

import { GET, POST } from "./route";

const findFirst = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    user: {
      findFirst,
      create,
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
    makeRequest({
      method: "POST",
      url: "http://localhost/api/auth/login",
      json: body,
      headers: { origin: "http://localhost" },
    });

  it("authenticates with the configured password", async () => {
    findFirst.mockResolvedValue({
      id: "user-123",
      email: "recruiter@test.demo",
      displayName: "Recruiter",
      role: "RECRUITER",
      tenantId: "default-tenant",
      status: "ACTIVE",
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
    expect(response.cookies.get("ete_session")?.value).toBeTruthy();
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
      status: "ACTIVE",
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
      status: "ACTIVE",
    });

    const response = await POST(buildRequest({ email: "recruiter@test.demo", password: "wrong" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Invalid email or password" });
  });

  it("rejects suspended users", async () => {
    findFirst.mockResolvedValue({
      id: "user-123",
      email: "recruiter@test.demo",
      displayName: "Recruiter",
      role: "RECRUITER",
      tenantId: "default-tenant",
      status: "SUSPENDED",
    });

    const response = await POST(
      buildRequest({ email: "recruiter@test.demo", password: "super-secret" }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Invalid email or password" });
  });

  it("creates a new user when credentials are valid but the user is missing", async () => {
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({
      id: "user-999",
      email: "new.user@test.demo",
      displayName: "new.user@test.demo",
      role: "RECRUITER",
      tenantId: "default-tenant",
      status: "ACTIVE",
    });

    const response = await POST(
      buildRequest({ email: "new.user@test.demo", password: "super-secret" }),
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(create).toHaveBeenCalledWith({
      data: {
        email: "new.user@test.demo",
        displayName: "new.user@test.demo",
        role: "RECRUITER",
        tenantId: "default-tenant",
      },
    });
    expect(payload.user).toEqual({
      id: "user-999",
      email: "new.user@test.demo",
      displayName: "new.user@test.demo",
      role: "RECRUITER",
      tenantId: "default-tenant",
    });
  });
});

describe("GET /api/auth/login", () => {
  it("redirects to the login page", async () => {
    const response = await GET(makeRequest({ method: "GET", url: "http://localhost/api/auth/login" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });
});
