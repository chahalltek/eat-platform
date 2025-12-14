"use client";

import { useEffect, useState } from "react";
import { ShieldExclamationIcon } from "@heroicons/react/24/outline";

type WhoAmIResponse = {
  user: { id: string; email: string | null; displayName: string | null; role: string | null; tenantId?: string | null } | null;
  roles: string[];
  tenant: { requested: string | null; session: string | null };
  roleHint: string | null;
  access: {
    hasAccess: boolean;
    isGlobalAdmin: boolean;
    membership: { tenantId: string; userId: string; role: string } | null;
    roleHint: string | null;
    reason?: string;
  };
  environment?: string;
};

type Props = { tenantId: string; enabled: boolean };

export function AdminAccessDebugCard({ tenantId, enabled }: Props) {
  const [debug, setDebug] = useState<WhoAmIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    async function load() {
      setError(null);
      try {
        const response = await fetch(`/api/admin/whoami?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" });

        if (!response.ok) {
          throw new Error(`Unable to load admin debug info (${response.status})`);
        }

        const payload = (await response.json()) as WhoAmIResponse;
        setDebug(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load admin debug info");
      }
    }

    void load();
  }, [enabled, tenantId]);

  if (!enabled) return null;

  return (
    <section className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
      <div className="flex items-start gap-2">
        <ShieldExclamationIcon className="h-5 w-5 flex-none" aria-hidden />
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            <span>Admin access debug</span>
            {debug?.environment ? <span className="rounded-full bg-white px-2 py-1">{debug.environment}</span> : null}
            <span className="rounded-full bg-white px-2 py-1">Tenant: {tenantId || "(none)"}</span>
          </div>
          {error ? (
            <p className="text-amber-800">{error}</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="font-semibold">Identity</p>
                <p>User ID: {debug?.user?.id ?? "(none)"}</p>
                <p>Display: {debug?.user?.displayName ?? "(none)"}</p>
                <p>Email: {debug?.user?.email ?? "(none)"}</p>
                <p>Role: {debug?.user?.role ?? "(none)"}</p>
                <p>Session tenant: {debug?.tenant.session ?? "(none)"}</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold">Access evaluation</p>
                <p>Has access: {debug?.access?.hasAccess ? "yes" : "no"}</p>
                <p>Global admin: {debug?.access?.isGlobalAdmin ? "yes" : "no"}</p>
                <p>Header role hint: {debug?.roleHint ?? debug?.access?.roleHint ?? "(none)"}</p>
                <p>Membership: {debug?.access?.membership ? `${debug.access.membership.role} (${debug.access.membership.tenantId})` : "none"}</p>
                <p>Reason: {debug?.access?.reason ?? "(not available)"}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
