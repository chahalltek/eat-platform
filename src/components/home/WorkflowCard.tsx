"use client";

import Link from "next/link";
import clsx from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type { SubsystemKey, SubsystemState } from "@/lib/systemStatusTypes";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

type BadgeState = "enabled" | "idle" | SubsystemState;
type WorkflowDependencyState = SubsystemState | "idle";

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
  dependencyStatus?: WorkflowDependencyState;
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
    case "idle":
      return "Idle / ready";
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

function formatDependencyStatus(status: WorkflowDependencyState) {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "idle":
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
    warning: "border-amber-100 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200",
    error: "border-rose-100 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200",
    info: "border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-zinc-900 dark:text-slate-100",
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
    <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-zinc-900">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="text-base font-semibold text-slate-900 dark:text-slate-50">{value}</dd>
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
  status: WorkflowDependencyState;
  message: string;
  systemLink: string;
  variant?: "default" | "strong";
}) {
  const pillStyles: Record<WorkflowDependencyState, string> = {
    healthy:
      "border-emerald-200 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-50 dark:ring-emerald-600",
    idle:
      "border-slate-300 bg-slate-50 text-slate-900 ring-1 ring-slate-200 dark:border-slate-700 dark:bg-zinc-900/60 dark:text-slate-50 dark:ring-slate-600",
    warning:
      "border-amber-200 bg-amber-50 text-amber-900 ring-1 ring-amber-200 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-50 dark:ring-amber-600",
    error:
      "border-rose-200 bg-rose-50 text-rose-900 ring-1 ring-rose-200 dark:border-rose-700 dark:bg-rose-900/50 dark:text-rose-50 dark:ring-rose-600",
    unknown:
      "border-slate-200 bg-slate-50 text-slate-900 ring-1 ring-slate-200 dark:border-slate-700 dark:bg-zinc-900/60 dark:text-slate-50 dark:ring-slate-600",
  };

  const dotStyles: Record<WorkflowDependencyState, string> = {
    healthy: "bg-emerald-500",
    idle: "bg-slate-500",
    warning: "bg-amber-500",
    error: "bg-rose-500",
    unknown: "bg-slate-400",
  };

  const containerStyles =
    variant === "strong"
      ? "border-border bg-card text-card-foreground dark:border-border dark:bg-card"
      : "border-border/80 bg-card text-card-foreground/90 dark:border-border/80 dark:bg-card/90";

  return (
    <div
      className={clsx(
        "rounded-2xl border px-4 py-4 text-sm shadow-sm",
        "flex flex-col gap-2",
        containerStyles,
      )}
    >
      <div className="flex flex-wrap items-center gap-3 font-semibold text-foreground dark:text-foreground">
        <span className="text-sm">{label}</span>
        <span
          className={clsx(
            "flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-[11px] uppercase tracking-wide shadow-sm dark:bg-card",
            pillStyles[status],
          )}
        >
          <span className={clsx("h-2 w-2 rounded-full", dotStyles[status])} aria-hidden />
          <span className="text-slate-700 dark:text-slate-200">{formatDependencyStatus(status)} dependency</span>
        </span>
      </div>
      <p className="text-xs text-foreground/80 dark:text-foreground/80">{message}</p>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
        <span className="h-2 w-2 rounded-full bg-slate-400 shadow-sm" aria-hidden />
        <span>{systemLink}</span>
        <span className="text-[10px] text-slate-400">System link</span>
      </div>
    </div>
  );
}

function WorkflowCardFooter({ cta, href, disabled }: { cta: string; href: string; disabled?: boolean }) {
  const content = (
    <div
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition",
        disabled ? "opacity-60" : "group-hover:-translate-y-0.5 group-hover:shadow-md",
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
  const previousBadgeState = useRef<BadgeState | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsBadgeAnimating(false);
      previousBadgeState.current = badgeState;
      return;
    }

    const badgeChanged = !previousBadgeState.current || previousBadgeState.current !== badgeState;
    if (badgeChanged) {
      setIsBadgeAnimating(true);
      previousBadgeState.current = badgeState;

      const badgeTimeout = setTimeout(() => setIsBadgeAnimating(false), 200);

      return () => {
        clearTimeout(badgeTimeout);
      };
    }

    previousBadgeState.current = badgeState;
  }, [badgeState, prefersReducedMotion]);

  const dependencyStatus: WorkflowDependencyState = dependencyState.dependencyStatus ?? "unknown";
  const dependencyLabel =
    dependencyState.dependencyLabel ?? dependencyLabels[link.dependency?.subsystem ?? "agents"];

  const systemLinkLabel = link.dependency?.flow?.target ?? dependencyLabel;
  const dependencyMessage = dependencyState.message ?? `${link.label} depends on ${dependencyLabel}`;

  return (
    <article
      key={link.href}
      className={clsx(
        "group flex min-h-[420px] flex-col gap-5 overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 pb-5 pt-4 shadow-sm ring-1 ring-transparent transition",
        "dark:border-slate-800 dark:bg-zinc-900",
        dependencyState.isActive
          ? "hover:-translate-y-0.5 hover:shadow-md hover:ring-slate-200 dark:hover:ring-slate-700"
          : "pointer-events-none opacity-60",
        prefersReducedMotion && "!transform-none !transition-none",
      )}
      aria-disabled={!dependencyState.isActive}
    >
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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">Workflow</p>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{link.label}</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            {link.description ?? `${link.label} workflow`}
          </p>
        </div>
        <span
          className={clsx(
            "mt-1 flex max-w-[14rem] flex-wrap items-center gap-2 self-start rounded-full border px-3 py-1 text-xs font-semibold leading-tight shadow-sm sm:self-center",
            badgeStyles[badgeState],
            isBadgeAnimating && "status-change-animate",
          )}
        >
          <span className="h-2 w-2 rounded-full bg-current opacity-80" aria-hidden />
          <span className="break-words text-pretty">{formatStatusText(badgeState)}</span>
        </span>
      </header>

      <div className="mt-2 flex flex-col gap-4 text-sm text-slate-600 dark:text-zinc-300">
        {alert ? <WorkflowAlert title={alert.title} description={alert.description} tone={alert.tone} /> : null}
        {statusPanel ? <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-zinc-900">{statusPanel}</div> : null}
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

      <div className="mt-auto flex items-end justify-start">
        <WorkflowCardFooter cta={link.cta} href={link.href} disabled={!dependencyState.isActive} />
      </div>
    </article>
  );
}
