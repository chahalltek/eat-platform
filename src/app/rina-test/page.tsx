import Link from "next/link";

import { ClientActionLink } from "@/components/ClientActionLink";
import { EATClientLayout } from "@/components/EATClientLayout";
import { FEATURE_FLAGS, isFeatureEnabled } from "@/lib/featureFlags";
import { EATClientLayout } from "@/components/EATClientLayout";

import { RinaTestClient } from "./RinaTestClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function RinaTestPage() {
  const [uiEnabled, agentsEnabled] = await Promise.all([
    isFeatureEnabled(FEATURE_FLAGS.UI_BLOCKS),
    isFeatureEnabled(FEATURE_FLAGS.AGENTS),
  ]);

  const header = (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">RINA Test Console</h1>
        <p className="text-sm text-slate-500">
          Send resume text through the RINA agent and view the structured response.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <ClientActionLink href="/eat/about">About EAT</ClientActionLink>
        <ClientActionLink href="/">Back to home</ClientActionLink>
      </div>
    </div>
  );

  if (!uiEnabled) {
    return (
<<<<<<< ours
      <EATClientLayout>
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-amber-900">UI blocks are disabled</h1>
=======
      <EATClientLayout maxWidthClassName="max-w-4xl" contentClassName="space-y-4">
        {header}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-amber-900">UI blocks are disabled</h2>
>>>>>>> theirs
          <p className="mt-2 text-sm text-amber-800">
            The RINA test console is hidden because UI blocks are turned off. Enable the UI Blocks flag to bring this
            experience back.
          </p>
          <div className="mt-4">
            <Link href="/" className="text-sm font-medium text-amber-900 underline">
              Return to home
            </Link>
          </div>
        </div>
      </EATClientLayout>
    );
  }

  return (
<<<<<<< ours
    <EATClientLayout>
=======
    <EATClientLayout maxWidthClassName="max-w-4xl" contentClassName="space-y-6">
      {header}

      {!agentsEnabled ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Agents are disabled. Enable the Agents feature flag to run this workflow.
        </div>
      ) : null}

>>>>>>> theirs
      <RinaTestClient agentsEnabled={agentsEnabled} />
    </EATClientLayout>
  );
}
