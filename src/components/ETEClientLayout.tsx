import clsx from "clsx";
import { PropsWithChildren } from "react";

import { BRANDING } from "@/config/branding";

import { AgentFailureBanner } from "@/components/AgentFailureBanner";
import { FireDrillBanner } from "@/components/FireDrillBanner";
import { UserSessionActions } from "@/components/auth/UserSessionActions";
import { getAgentFailureCount } from "@/lib/agents/failures";
import type { IdentityUser } from "@/lib/auth/types";
import { getCurrentUser } from "@/lib/auth/user";
import type { SystemModeName } from "@/lib/modes/systemModes";
import { loadTenantMode } from "@/lib/modes/loadTenantMode";
import { getCurrentTenantId } from "@/lib/tenant";

function normalizeHex(color: string) {
  const hex = color.replace("#", "");

  if (hex.length === 3) {
    return hex
      .split("")
      .map((char) => char.repeat(2))
      .join("");
  }

  if (hex.length === 8) {
    return hex.slice(0, 6);
  }

  return hex.padEnd(6, "0");
}

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
  let currentUser: IdentityUser | null = null;

  try {
    const user = await getCurrentUser();
    currentUser = user;
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
  const accentTint = normalizeHex(BRANDING.accentColor);
  const accentColor = `#${accentTint}`;
  const accentBackground = `rgba(${parseInt(accentTint.slice(0, 2), 16)}, ${parseInt(
    accentTint.slice(2, 4),
    16,
  )}, ${parseInt(accentTint.slice(4, 6), 16)}, 0.08)`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {BRANDING.headerText ? (
        <div className={clsx("mx-auto px-6", maxWidthClassName)}>
          <div
            className="mt-4 mb-1 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold"
            style={{
              color: accentColor,
              borderColor: `${accentColor}26`,
              backgroundColor: accentBackground,
            }}
          >
            <span
              aria-hidden
              className="inline-flex h-2.5 w-2.5 rounded-full shadow-sm"
              style={{ backgroundColor: accentColor, boxShadow: `0 0 0 6px ${accentBackground}` }}
            />
            <span className="leading-tight">{BRANDING.headerText}</span>
          </div>
        </div>
      ) : null}
      {isFireDrill ? <FireDrillBanner maxWidthClassName={maxWidthClassName} /> : null}
      <AgentFailureBanner initialCount={failedRuns} maxWidthClassName={maxWidthClassName} />
      <main className={clsx("mx-auto px-6 py-8", maxWidthClassName, contentClassName)}>
        <div className="mb-6 flex justify-end">
          <UserSessionActions user={currentUser} />
        </div>
        {children}
      </main>
    </div>
  );
}
