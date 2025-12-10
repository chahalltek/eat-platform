import clsx from "clsx";
import { PropsWithChildren } from "react";

import { AgentFailureBanner } from "@/components/AgentFailureBanner";
import { getAgentFailureCount } from "@/lib/agents/failures";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentTenantId } from "@/lib/tenant";

type EATClientLayoutProps = PropsWithChildren<{
  maxWidthClassName?: string;
  contentClassName?: string;
}>;

export async function EATClientLayout({
  children,
  maxWidthClassName = "max-w-6xl",
  contentClassName,
}: EATClientLayoutProps) {
  let failedRuns = 0;

  try {
    const user = await getCurrentUser();
    const tenantId = await getCurrentTenantId();

    if (user) {
      failedRuns = await getAgentFailureCount(tenantId);
    }
  } catch (error) {
    console.error("[eat-client-layout] failed to resolve failure count", error);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AgentFailureBanner initialCount={failedRuns} maxWidthClassName={maxWidthClassName} />
      <main className={clsx("mx-auto px-6 py-8", maxWidthClassName, contentClassName)}>{children}</main>
    </div>
  );
}
