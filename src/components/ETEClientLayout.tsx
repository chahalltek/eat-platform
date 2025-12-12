import clsx from "clsx";
import { PropsWithChildren } from "react";

import { AgentFailureBanner } from "@/components/AgentFailureBanner";
import { FireDrillBanner } from "@/components/FireDrillBanner";
import { getAgentFailureCount } from "@/lib/agents/failures";
import { getCurrentUser } from "@/lib/auth/user";
import type { SystemModeName } from "@/lib/modes/systemModes";
import { getCurrentTenantId } from "@/lib/tenant";
import { loadTenantMode } from "@/lib/modes/loadTenantMode";

type ETEClientLayoutProps = PropsWithChildren<{
  maxWidthClassName?: string;
  contentClassName?: string;
  showFireDrillBanner?: boolean;
}>;

export async function ETEClientLayout({
  children,
  maxWidthClassName = "max-w-6xl",
  contentClassName,
  showFireDrillBanner = true,
}: ETEClientLayoutProps) {
  let failedRuns = 0;
  let tenantMode: SystemModeName | null = null;

  try {
    const user = await getCurrentUser();
    const tenantId = await getCurrentTenantId();

    const mode = await loadTenantMode(tenantId);
    tenantMode = mode.mode;

    if (user) {
      failedRuns = await getAgentFailureCount(tenantId);
    }
  } catch (error) {
    console.error("[ete-client-layout] failed to resolve failure count", error);
  }

  const isFireDrill = showFireDrillBanner && tenantMode === "fire_drill";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {isFireDrill ? <FireDrillBanner maxWidthClassName={maxWidthClassName} /> : null}
      <AgentFailureBanner initialCount={failedRuns} maxWidthClassName={maxWidthClassName} />
      <main className={clsx("mx-auto px-6 py-8", maxWidthClassName, contentClassName)}>{children}</main>
    </div>
  );
}
