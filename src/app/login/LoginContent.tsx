/* eslint-disable @next/next/no-img-element */
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { BRANDING } from "@/config/branding";
import {
  DEFAULT_BRAND_LOGO,
  DEFAULT_BRAND_LOGO_ALT,
  DEFAULT_BRAND_NAME,
  type TenantBranding,
} from "@/lib/tenant/branding.shared";

type LoginContentProps = {
  branding: TenantBranding;
};

function normalizeLogoPath(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }

  return path.startsWith("/") ? path : `/${path}`;
}

export function LoginContent({ branding }: LoginContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [logoIndex, setLogoIndex] = useState(0);

  const logoAlt = useMemo(() => branding.brandLogoAlt || DEFAULT_BRAND_LOGO_ALT, [branding.brandLogoAlt]);
  const logoSources = useMemo(() => {
    const sources = [
      branding.brandLogoUrl ?? null,
      BRANDING.logoHorizontal,
      DEFAULT_BRAND_LOGO,
      "/public/ete-logo.svg",
    ];

    return sources.filter(Boolean).map((src) => normalizeLogoPath(src as string));
  }, [branding.brandLogoUrl]);
  const logoSrc = logoSources[Math.min(logoIndex, logoSources.length - 1)];

  useEffect(() => {
    setLogoIndex(0);
  }, [branding.brandLogoUrl]);

  const handleLogoError = () => {
    setLogoIndex((current) => (current + 1 < logoSources.length ? current + 1 : current));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.error || "Invalid email or password";
        throw new Error(message);
      }

      const next = searchParams.get("next") ?? "/";
      router.push(next);
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : "Login failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-12">
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col items-center text-center">
            <img
              src={logoSrc}
              alt={logoAlt}
              onError={handleLogoError}
              className="mb-4 max-h-12 w-auto max-w-[220px]"
            />
            <h1 className="text-xl font-semibold">Sign in to {branding.brandName || DEFAULT_BRAND_NAME}</h1>
            <p className="text-sm text-zinc-600">Use your workspace credentials to access the platform.</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-800" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-800" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              required
              autoComplete="current-password"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </main>
    </div>
  );
}
