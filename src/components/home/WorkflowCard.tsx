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
  dependencyDotStyles: Record<SubsystemState, string>;
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

export function WorkflowCard({
  link,
  badgeState,
  dependencyState,
  badgeStyles,
  dependencyLabels,
  dependencyDotStyles,
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

  return (
    <Link
      key={link.href}
      href={link.href}
      className={clsx(
        "group relative overflow-hidden rounded-2xl border border-indigo-100/70 bg-white/80 p-6 shadow-sm ring-1 ring-transparent backdrop-blur transition",
        "dark:border-indigo-900/40 dark:bg-zinc-900/80",
        dependencyState.isActive
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:ring-indigo-200 dark:hover:ring-indigo-800"
          : "pointer-events-none cursor-not-allowed opacity-60",
        prefersReducedMotion && "!transform-none !transition-none",
      )}
      aria-disabled={!dependencyState.isActive}
      tabIndex={dependencyState.isActive ? 0 : -1}
    >
      <div className={topRailClassName} aria-hidden />

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500 dark:text-indigo-300">Workflow</p>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{link.label}</h2>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {link.description ?? `${link.label} workflow`}
          </p>
        </div>
        <span
          className={clsx(
            "rounded-full border px-3 py-1 text-xs font-semibold leading-none shadow-sm",
            badgeStyles[badgeState],
            isBadgeAnimating && "status-change-animate",
          )}
        >
          {formatStatusText(badgeState)}
        </span>
      </div>

      {link.stats ? (
        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          {link.stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col rounded-xl border border-indigo-100/80 bg-indigo-50/40 px-3 py-2 dark:border-indigo-900/30 dark:bg-indigo-950/30"
            >
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-200">
                {stat.label}
              </dt>
              <dd className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{stat.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {children}

      {link.dependency ? (
        <div className="mt-4 rounded-xl border border-dashed border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm dark:border-indigo-900/40 dark:bg-indigo-950/40">
          <div className="flex items-center gap-3 font-semibold text-indigo-900 dark:text-indigo-100">
            <span className={`h-2.5 w-2.5 rounded-full ${dependencyDotStyles[dependencyStatus]}`} aria-hidden />
            <span>{link.dependency.flow?.target ?? dependencyLabel}</span>
            <span className="rounded-full border border-indigo-200/60 bg-white/70 px-2 py-0.5 text-[11px] uppercase tracking-wide text-indigo-600 dark:border-indigo-800/70 dark:bg-indigo-900/60">
              {formatDependencyStatus(dependencyStatus)} dependency
            </span>
          </div>
          <p className="mt-1 text-xs text-indigo-700 dark:text-indigo-200/80">
            {dependencyState.message ?? `${link.label} depends on ${dependencyLabel}`}
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span className={`h-2 w-2 rounded-full ${dependencyDotStyles[dependencyStatus]}`} aria-hidden />
          <span className="font-medium text-zinc-700 dark:text-zinc-200">
            {dependencyLabels[link.dependency?.subsystem ?? "agents"]}
          </span>
          <span className="text-[11px] uppercase tracking-wide text-zinc-400">System link</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-indigo-700">
          <span>{link.cta}</span>
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
      </div>
    </Link>
  );
}
