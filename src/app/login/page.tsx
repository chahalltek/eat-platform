import type { Metadata } from "next";

import { LoginContent } from "./LoginContent";
import { DEFAULT_BRAND_NAME } from "@/lib/tenant/branding.shared";
import { loadTenantBranding } from "@/lib/tenant/branding";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await loadTenantBranding();
  const brandName = branding.brandName || DEFAULT_BRAND_NAME;

  return {
    title: `Sign in to ${brandName}`,
    description: `Sign in to ${brandName}`,
    openGraph: {
      title: `Sign in to ${brandName}`,
      description: `Sign in to ${brandName}`,
    },
  };
<<<<<<< ours

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-12">
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col items-center text-center">
            <EteLogo variant="horizontal" image="/ete-logo.svg" className="mb-4 items-center" tagline="" />
            <h1 className="text-xl font-semibold">Sign in</h1>
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
=======
>>>>>>> theirs
}

export default async function LoginPage() {
  const branding = await loadTenantBranding();

  return <LoginContent branding={branding} />;
}
