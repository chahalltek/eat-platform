"use client";

import Link from "next/link";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { SubsystemKey, SubsystemState } from "@/lib/systemStatus";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

type BadgeState = "enabled" | SubsystemState;

export type WorkflowCardLink = {
  label: string;
  cta: string;
  href: string;
  description?: string;
  stats?: { label: string; value: string }[];
  dependency?: {
    subsystem: SubsystemKey;
    label?: string;
    flow?: {
      source: string;
      target: string;
    };
  };
};

export type WorkflowCardState = {
  status: BadgeState;
  isActive: boolean;
  dependencyStatus?: SubsystemState;
  dependencyLabel?: string;
  message?: string;
};

export type WorkflowCardProps = {
  link: WorkflowCardLink;
  badgeState: BadgeState;
  dependencyState: WorkflowCardState;
  badgeStyles: Record<string, string>;
  dependencyLabels: Record<SubsystemKey, string>;
  statusPanel?: ReactNode;
  statusChips?: { label: string; value: string }[];
  alert?: {
    title: string;
    description?: string;
    tone?: "warning" | "error" | "info";
  };
  children?: ReactNode;
};

function formatStatusText(status: BadgeState) {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Waiting";
    case "error":
      return "Fault";
    case "unknown":
      return "Status unavailable";
    case "enabled":
    default:
      return "Enabled";
  }
}

function formatDependencyStatus(status: SubsystemState) {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Waiting";
    case "error":
      return "Fault";
    default:
      return "Status unavailable";
  }
}

function WorkflowAlert({
  title,
  description,
  tone = "warning",
}: {
  title: string;
  description?: string;
  tone?: "warning" | "error" | "info";
}) {
  const toneStyles: Record<typeof tone, string> = {
    warning: "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200",
    error: "border-rose-200 bg-rose-50/70 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-200",
    info: "border-indigo-200 bg-indigo-50/70 text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/50 dark:text-indigo-200",
  };

  return (
    <div
      className={clsx(
        "rounded-xl border px-4 py-3 text-sm shadow-sm",
        "flex flex-col gap-1",
        toneStyles[tone],
      )}
    >
      <p className="font-semibold">{title}</p>
      {description ? <p className="text-xs opacity-80">{description}</p> : null}
    </div>
  );
}

function WorkflowStatusChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-indigo-100/80 bg-indigo-50/50 px-3 py-2 dark:border-indigo-900/30 dark:bg-indigo-950/30">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-200">{label}</dt>
      <dd className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{value}</dd>
    </div>
  );
}

function WorkflowDependencies({
  label,
  status,
  message,
  systemLink,
  variant = "default",
}: {
  label: string;
  status: SubsystemState;
  message: string;
  systemLink: string;
  variant?: "default" | "strong";
}) {
  const pillStyles: Record<SubsystemState, string> = {
    healthy: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-900/70",
    warning: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-900/70",
    error: "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-900/70",
    unknown: "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700",
  };

  const containerStyles =
    variant === "strong"
      ? "border-indigo-200/80 bg-indigo-50/70 dark:border-indigo-900/60 dark:bg-indigo-950/60"
      : "border-indigo-100/80 bg-indigo-50/60 dark:border-indigo-900/40 dark:bg-indigo-950/40";

  return (
    <div
      className={clsx(
        "rounded-2xl border px-4 py-4 text-sm shadow-sm",
        "flex flex-col gap-2",
        containerStyles,
      )}
    >
      <div className="flex flex-wrap items-center gap-3 font-semibold text-indigo-900 dark:text-indigo-50">
        <span className="text-sm">{label}</span>
        <span
          className={clsx(
            "flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-wide shadow-sm",
            pillStyles[status],
          )}
        >
          <span className="h-2 w-2 rounded-full bg-current opacity-80" aria-hidden />
          {formatDependencyStatus(status)} dependency
        </span>
      </div>
      <p className="text-xs text-indigo-700 dark:text-indigo-200/80">{message}</p>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
        <span className="h-2 w-2 rounded-full bg-indigo-400 shadow-sm" aria-hidden />
        <span>{systemLink}</span>
        <span className="text-[10px] text-indigo-400">System link</span>
      </div>
    </div>
  );
}

function WorkflowCardFooter({ cta, href, disabled }: { cta: string; href: string; disabled?: boolean }) {
  const content = (
    <div
      className={clsx(
        "inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition",
        disabled ? "opacity-70" : "group-hover:bg-indigo-700",
      )}
    >
      <span>{cta}</span>
      <svg
        aria-hidden
        className="h-4 w-4 transition group-hover:translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    </div>
  );

  if (disabled) {
    return <div className="pt-1 opacity-80">{content}</div>;
  }

  return (
    <Link href={href} className="pt-1">
      {content}
    </Link>
  );
}

export function WorkflowCard({
  link,
  badgeState,
  dependencyState,
  badgeStyles,
  dependencyLabels,
  statusPanel,
  statusChips,
  alert,
  children,
}: WorkflowCardProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isBadgeAnimating, setIsBadgeAnimating] = useState(false);
  const [isRailPulsing, setIsRailPulsing] = useState(false);
  const previousBadgeState = useRef<BadgeState | null>(null);

  const topRailClassName = useMemo(
    () =>
      clsx(
        "absolute inset-x-6 top-0 h-1 rounded-full bg-gradient-to-r from-indigo-400 via-blue-400 to-emerald-400 opacity-70",
        !prefersReducedMotion && isRailPulsing && "workflow-rail-pulse",
      ),
    [isRailPulsing, prefersReducedMotion],
  );

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsBadgeAnimating(false);
      setIsRailPulsing(false);
      previousBadgeState.current = badgeState;
      return;
    }

    const badgeChanged = !previousBadgeState.current || previousBadgeState.current !== badgeState;
    if (badgeChanged) {
      setIsBadgeAnimating(true);
      setIsRailPulsing(true);
      previousBadgeState.current = badgeState;

      const badgeTimeout = setTimeout(() => setIsBadgeAnimating(false), 200);
      const railTimeout = setTimeout(() => setIsRailPulsing(false), 320);

      return () => {
        clearTimeout(badgeTimeout);
        clearTimeout(railTimeout);
      };
    }

    previousBadgeState.current = badgeState;
  }, [badgeState, prefersReducedMotion]);

  const dependencyStatus = dependencyState.dependencyStatus ?? "unknown";
  const dependencyLabel =
    dependencyState.dependencyLabel ?? dependencyLabels[link.dependency?.subsystem ?? "agents"];

  const systemLinkLabel = link.dependency?.flow?.target ?? dependencyLabel;
  const dependencyMessage = dependencyState.message ?? `${link.label} depends on ${dependencyLabel}`;

  return (
    <article
      key={link.href}
      className={clsx(
        "group relative grid min-h-[440px] grid-rows-[auto,1fr,auto] content-start overflow-hidden rounded-2xl border border-indigo-100/70 bg-white/80 px-5 pb-5 pt-4 shadow-sm ring-1 ring-transparent backdrop-blur transition",
        "dark:border-indigo-900/40 dark:bg-zinc-900/80",
        dependencyState.isActive
          ? "hover:-translate-y-0.5 hover:shadow-lg hover:ring-indigo-200 dark:hover:ring-indigo-800"
          : "pointer-events-none opacity-60",
        prefersReducedMotion && "!transform-none !transition-none",
      )}
      aria-disabled={!dependencyState.isActive}
    >
      <div className={topRailClassName} aria-hidden />

      {/*
      -------------------------------------
      | Zone A – Header                   |
      -------------------------------------
      | Zone B – Status / Dependencies    |
      |         (auto height)             |
      -------------------------------------
      | Zone C – CTA (anchored bottom)    |
      -------------------------------------
      */}
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500 dark:text-indigo-300">Workflow</p>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{link.label}</h2>
          </div>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {link.description ?? `${link.label} workflow`}
          </p>
        </div>
        <span
          className={clsx(
            "mt-1 self-start rounded-full border px-3 py-1 text-xs font-semibold leading-none shadow-sm sm:self-center",
            badgeStyles[badgeState],
            isBadgeAnimating && "status-change-animate",
          )}
        >
          {formatStatusText(badgeState)}
        </span>
      </header>

      <div className="mt-4 flex flex-col gap-4">
        {alert ? <WorkflowAlert title={alert.title} description={alert.description} tone={alert.tone} /> : null}
        {statusPanel}

        {statusChips?.length ? (
          <dl className="grid gap-2 sm:grid-cols-2">
            {statusChips.map((stat) => (
              <WorkflowStatusChip key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </dl>
        ) : null}

        {children}

        {link.dependency ? (
          <WorkflowDependencies
            label={link.dependency.flow?.target ?? dependencyLabel}
            status={dependencyStatus}
            message={dependencyMessage}
            systemLink={systemLinkLabel}
            variant={dependencyStatus === "error" ? "strong" : "default"}
          />
        ) : null}
      </div>

      <div className="mt-6 flex items-end justify-start">
        <WorkflowCardFooter cta={link.cta} href={link.href} disabled={!dependencyState.isActive} />
      </div>
    </article>
  );
}
