import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/user";
import { listFeatureFlags } from "@/lib/featureFlags";

import { FeatureFlagsPanel } from "./FeatureFlagsPanel";

export const dynamic = "force-dynamic";

function isAdmin(user: { role: string | null } | null) {
  return (user?.role ?? "").toUpperCase() === "ADMIN";
}

export default async function FeatureFlagsPage() {
  const user = await getCurrentUser();

  if (!isAdmin(user)) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-amber-800">
            You need an admin role to manage feature flags. Switch to an admin user to continue.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium text-amber-900 underline">
              Return to home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const flags = await listFeatureFlags();

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Admin</p>
            <h1 className="text-3xl font-semibold text-zinc-900">Feature flag control</h1>
            <p className="text-sm text-zinc-600">
              Toggle access to agents, scoring, and UI blocks without redeploying the platform.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
          >
            Back to home
          </Link>
        </header>

        <FeatureFlagsPanel
          initialFlags={flags.map((flag) => ({
            ...flag,
            updatedAt: flag.updatedAt.toISOString(),
          }))}
        />
      </div>
    </main>
  );
}
