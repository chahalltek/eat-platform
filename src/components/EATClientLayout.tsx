import clsx from "clsx";
import { PropsWithChildren } from "react";
import type { TenantMode } from "@prisma/client";

import { AgentFailureBanner } from "@/components/AgentFailureBanner";
import { FireDrillBanner } from "@/components/FireDrillBanner";
import { getAgentFailureCount } from "@/lib/agents/failures";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";
import { getTenantMode } from "@/lib/tenantMode";

type EATClientLayoutProps = PropsWithChildren<{
  maxWidthClassName?: string;
  contentClassName?: string;
  showFireDrillBanner?: boolean;
}>;

export async function EATClientLayout({
  children,
  maxWidthClassName = "max-w-6xl",
  contentClassName,
  showFireDrillBanner = true,
}: EATClientLayoutProps) {
  let failedRuns = 0;
  let tenantMode: TenantMode | null = null;

  try {
    const user = await getCurrentUser();
    const tenantId = await getCurrentTenantId();

    tenantMode = await getTenantMode(tenantId);

    if (user) {
      failedRuns = await getAgentFailureCount(tenantId);
    }
  } catch (error) {
    console.error("[eat-client-layout] failed to resolve failure count", error);
  }

  const isFireDrill = showFireDrillBanner && tenantMode === "FIRE_DRILL";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {isFireDrill ? <FireDrillBanner maxWidthClassName={maxWidthClassName} /> : null}
      <AgentFailureBanner initialCount={failedRuns} maxWidthClassName={maxWidthClassName} />
      <main className={clsx("mx-auto px-6 py-8", maxWidthClassName, contentClassName)}>{children}</main>
    </div>
  );
}
