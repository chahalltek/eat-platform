"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";

import { normalizeRole, USER_ROLES, type UserRole } from "@/lib/auth/roles";

export type AgentToolbarAction = "intake" | "profile" | "match" | "confidence" | "explain" | "shortlist";

type AgentToolbarProps = {
  role?: string | null;
  actions?: AgentToolbarAction[];
  onRun: Partial<Record<AgentToolbarAction, () => Promise<void>>>;
  initialLastRun?: Partial<Record<AgentToolbarAction, Date | string | null>>;
  disabledActions?: Partial<Record<AgentToolbarAction, boolean>>;
  className?: string;
};

const ACTION_ORDER: AgentToolbarAction[] = ["intake", "profile", "match", "confidence", "explain", "shortlist"];

const ACTION_LABELS: Record<AgentToolbarAction, string> = {
  intake: "Run Intake",
  profile: "Run Profile",
  match: "Run Match",
  confidence: "Run Confidence",
  explain: "Run Explain",
  shortlist: "Run Shortlist",
};

const ACTION_PERMISSIONS: Record<AgentToolbarAction, UserRole[]> = {
  intake: [USER_ROLES.ADMIN, USER_ROLES.SYSTEM_ADMIN, USER_ROLES.TENANT_ADMIN, USER_ROLES.RECRUITER],
  profile: [USER_ROLES.ADMIN, USER_ROLES.SYSTEM_ADMIN, USER_ROLES.TENANT_ADMIN, USER_ROLES.RECRUITER],
  match: [
    USER_ROLES.ADMIN,
    USER_ROLES.SYSTEM_ADMIN,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.RECRUITER,
    USER_ROLES.SOURCER,
    USER_ROLES.SALES,
  ],
  confidence: [
    USER_ROLES.ADMIN,
    USER_ROLES.SYSTEM_ADMIN,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.RECRUITER,
    USER_ROLES.SOURCER,
    USER_ROLES.SALES,
  ],
  explain: [
    USER_ROLES.ADMIN,
    USER_ROLES.SYSTEM_ADMIN,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.RECRUITER,
    USER_ROLES.SOURCER,
    USER_ROLES.SALES,
  ],
  shortlist: [
    USER_ROLES.ADMIN,
    USER_ROLES.SYSTEM_ADMIN,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.RECRUITER,
    USER_ROLES.SOURCER,
    USER_ROLES.SALES,
  ],
};

type ToastState = { message: string; tone: "success" | "error" };

function formatLastRun(date: Date | null) {
  if (!date) return "Not run yet";

  return `Last run ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function normalizeInitialLastRun(
  initial?: Partial<Record<AgentToolbarAction, Date | string | null>>,
): Record<AgentToolbarAction, Date | null> {
  const base = Object.fromEntries(ACTION_ORDER.map((action) => [action, null])) as Record<AgentToolbarAction, Date | null>;

  if (!initial) return base;

  return ACTION_ORDER.reduce<Record<AgentToolbarAction, Date | null>>((acc, action) => {
    const value = initial[action];
    if (!value) {
      acc[action] = null;
      return acc;
    }

    if (value instanceof Date) {
      acc[action] = value;
      return acc;
    }

    const parsed = new Date(value);
    acc[action] = Number.isNaN(parsed.getTime()) ? null : parsed;
    return acc;
  }, base);
}

export function AgentToolbar({
  role,
  actions = ACTION_ORDER,
  onRun,
  className,
  initialLastRun,
  disabledActions,
}: AgentToolbarProps) {
  const normalizedRole = normalizeRole(role);
  const permittedActions = useMemo(
    () =>
      actions.filter((action) => (normalizedRole ? ACTION_PERMISSIONS[action].includes(normalizedRole) : false)),
    [actions, normalizedRole],
  );
  const [loading, setLoading] = useState<Record<AgentToolbarAction, boolean>>(
    Object.fromEntries(ACTION_ORDER.map((action) => [action, false])) as Record<AgentToolbarAction, boolean>,
  );
  const [lastRun, setLastRun] = useState<Record<AgentToolbarAction, Date | null>>(() =>
    normalizeInitialLastRun(initialLastRun),
  );
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleRun = async (action: AgentToolbarAction) => {
    if (!permittedActions.includes(action)) return;

    if (disabledActions?.[action]) {
      return;
    }

    const handler = onRun[action];

    if (!handler) {
      setToast({ message: "Action is not wired to a runner yet.", tone: "error" });
      return;
    }

    setLoading((prev) => ({ ...prev, [action]: true }));
    setToast(null);

    try {
      await handler();
      setLastRun((prev) => ({ ...prev, [action]: new Date() }));
    } catch (err) {
      console.error("[agent-toolbar] failed to run action", err);
      const message =
        err instanceof Error ? err.message : "Agent action failed. Please try again or check with an admin.";
      setToast({ message, tone: "error" });
    } finally {
      setLoading((prev) => ({ ...prev, [action]: false }));
    }
  };

  if (permittedActions.length === 0) {
    return (
      <div className={clsx("rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600", className)}>
        No agent actions are available for your role.
      </div>
    );
  }

  return (
    <div className={clsx("space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Agent toolbar</p>
          <p className="text-sm text-slate-600">Actions respect RBAC and show per-action run states.</p>
        </div>
        {toast ? (
          <div
            role="status"
            aria-live="polite"
            className={clsx(
              "flex max-w-sm items-start gap-2 rounded-lg px-3 py-2 text-sm shadow-sm ring-1",
              toast.tone === "error"
                ? "bg-rose-50 text-rose-800 ring-rose-200"
                : "bg-emerald-50 text-emerald-800 ring-emerald-200",
            )}
          >
            <span aria-hidden>{toast.tone === "error" ? "⚠" : "✓"}</span>
            <span className="leading-snug">{toast.message}</span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {permittedActions.map((action) => {
          const label = ACTION_LABELS[action];
          const isLoading = loading[action];
          const wired = typeof onRun[action] === "function";
          const isDisabledByMode = Boolean(disabledActions?.[action]);
          return (
            <div
              key={action}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
            >
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-900">{label}</span>
                <span className="text-xs text-slate-500">{formatLastRun(lastRun[action])}</span>
                {isDisabledByMode ? (
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">Disabled for now</span>
                ) : !wired ? (
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">Not wired</span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => handleRun(action)}
                disabled={isLoading || !wired || isDisabledByMode}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
                  action === "shortlist"
                    ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-200"
                    : action === "intake"
                      ? "bg-slate-900 text-white shadow-sm ring-1 ring-slate-200"
                      : action === "profile"
                        ? "bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200"
                        : "bg-white text-slate-900 ring-1 ring-slate-200 shadow-sm",
                  isLoading || !wired ? "opacity-60" : "hover:-translate-y-0.5 hover:shadow-md",
                )}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2 items-center justify-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" aria-hidden />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-current" aria-hidden />
                    </span>
                    Running…
                  </span>
                ) : (
                  label
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
