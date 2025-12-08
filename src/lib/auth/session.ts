import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import crypto from "node:crypto";

import { DEFAULT_TENANT_ID } from "./config";

export type SessionPayload = {
  userId: string;
  tenantId?: string | null;
  email?: string | null;
  displayName?: string | null;
  role?: string | null;
  exp: number;
  iat: number;
};

const SESSION_COOKIE_NAME = "eat_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getRawSecret() {
  const explicitSecret = process.env.AUTH_SESSION_SECRET;
  const localSecret = process.env.AUTH_SESSION_SECRET_LOCAL;

  if (process.env.NODE_ENV === "production") {
    if (!explicitSecret) {
      throw new Error("AUTH_SESSION_SECRET must be set in production");
    }

    return explicitSecret;
  }

  return explicitSecret ?? localSecret ?? "development-session-secret";
}

function signPayload(payload: string) {
  return crypto.createHmac("sha256", getRawSecret()).update(payload).digest("base64url");
}

function encodePayload(payload: SessionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(encoded: string): SessionPayload | null {
  try {
    const raw = Buffer.from(encoded, "base64url").toString("utf8");
    return JSON.parse(raw) as SessionPayload;
  } catch {
    return null;
  }
}

export function createSessionCookie(user: {
  id: string;
  tenantId?: string | null;
  email?: string | null;
  displayName?: string | null;
  role?: string | null;
}) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    userId: user.id,
    tenantId: user.tenantId ?? DEFAULT_TENANT_ID,
    email: user.email ?? null,
    displayName: user.displayName ?? user.email ?? null,
    role: user.role ?? null,
    iat: issuedAt,
    exp: issuedAt + SESSION_DURATION_SECONDS,
  };

  const encoded = encodePayload(payload);
  const signature = signPayload(encoded);
  const token = `${encoded}.${signature}`;

  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  };
}

export function parseSessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  const payload = decodePayload(encodedPayload);
  if (!payload) return null;

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

function getTokenFromRequest(req?: NextRequest) {
  if (req) {
    return req.cookies.get(SESSION_COOKIE_NAME)?.value;
  }

  try {
    return cookies().get(SESSION_COOKIE_NAME)?.value;
  } catch {
    return undefined;
  }
}

export function getSessionClaims(req?: NextRequest) {
  const token = getTokenFromRequest(req);
  return parseSessionToken(token);
}

export { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS };
