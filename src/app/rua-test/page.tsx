import Link from "next/link";

import { FEATURE_FLAGS, isFeatureEnabled } from "@/lib/featureFlags";

import { RuaTestClient } from "./RuaTestClient";

export default async function RuaTestPage() {
  const [uiEnabled, agentsEnabled] = await Promise.all([
    isFeatureEnabled(FEATURE_FLAGS.UI_BLOCKS),
    isFeatureEnabled(FEATURE_FLAGS.AGENTS),
  ]);

  if (!uiEnabled) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-amber-900">UI blocks are disabled</h1>
          <p className="mt-2 text-sm text-amber-800">
            The RUA test console is hidden because UI blocks are turned off. Enable the UI Blocks flag to bring this
            experience back.
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

  return <RuaTestClient agentsEnabled={agentsEnabled} />;
}
