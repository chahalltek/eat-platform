import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

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

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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

function base64UrlEncode(data: Uint8Array) {
  const binary = String.fromCharCode(...data);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(encoded: string) {
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getSigningKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getRawSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signPayload(payload: string) {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

function encodePayload(payload: SessionPayload) {
  const data = encoder.encode(JSON.stringify(payload));
  return base64UrlEncode(data);
}

function decodePayload(encoded: string): SessionPayload | null {
  try {
    const raw = decoder.decode(base64UrlDecode(encoded));
    return JSON.parse(raw) as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSessionCookie(user: {
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
  const signature = await signPayload(encoded);
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

export async function parseSessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const key = await getSigningKey();
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(signature),
    encoder.encode(encodedPayload),
  );

  if (!isValid) {
    return null;
  }

  const payload = decodePayload(encodedPayload);
  if (!payload) return null;

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

async function getTokenFromRequest(req?: NextRequest) {
  if (req) {
    return req.cookies.get(SESSION_COOKIE_NAME)?.value;
  }

  try {
    const cookieStore = await cookies();

    return cookieStore.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    return undefined;
  }
}

export async function getSessionClaims(req?: NextRequest) {
  const token = await getTokenFromRequest(req);
  return parseSessionToken(token);
}

export { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS };
