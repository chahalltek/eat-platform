"use client";

import React, { useEffect, useState } from "react";
import clsx from "clsx";
import type { CellContext, ColumnDef } from "@tanstack/react-table";

import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

export type ETETableColumn<TData, TValue = unknown> = ColumnDef<TData, TValue>;

export type TableAccessorKey<TData> = Extract<keyof TData, string>;

const STATUS_VARIANT_STYLES = {
  success: {
    className:
      "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/45 dark:bg-emerald-500/10 dark:text-emerald-100",
    accent: "rgba(16, 185, 129, 0.36)",
  },
  warning: {
    className:
      "border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/45 dark:bg-amber-500/10 dark:text-amber-100",
    accent: "rgba(245, 158, 11, 0.38)",
  },
  error: {
    className:
      "border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/45 dark:bg-rose-500/12 dark:text-rose-100",
    accent: "rgba(244, 63, 94, 0.4)",
  },
  info: {
    className:
      "border border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/45 dark:bg-sky-500/10 dark:text-sky-100",
    accent: "rgba(56, 189, 248, 0.36)",
  },
  neutral: {
    className:
      "border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100",
    accent: "rgba(113, 113, 122, 0.34)",
  },
} as const satisfies Record<string, { className: string; accent: string }>;

export type StatusVariant = keyof typeof STATUS_VARIANT_STYLES;

export type TextColumnOptions<TData, TKey extends TableAccessorKey<TData>> = {
  accessorKey: TKey;
  header: string;
  sortable?: boolean;
  cell?: (context: CellContext<TData, TData[TKey]>) => React.ReactNode;
  filterFn?: ColumnDef<TData, TData[TKey]>["filterFn"];
};

export type NumberColumnOptions<TData, TKey extends TableAccessorKey<TData>> = {
  accessorKey: TKey;
  header: string;
  sortable?: boolean;
  formatValue?: (value: number) => React.ReactNode;
};

export type StatusBadgeColumnOptions<TData, TKey extends TableAccessorKey<TData>> = {
  accessorKey: TKey;
  header: string;
  sortable?: boolean;
  formatLabel?: (value: TData[TKey]) => string;
  getVariant?: (value: TData[TKey]) => StatusVariant;
};

export function createTextColumn<TData, TKey extends TableAccessorKey<TData>>({
  accessorKey,
  header,
  sortable = true,
  cell,
  filterFn,
}: TextColumnOptions<TData, TKey>): ETETableColumn<TData, TData[TKey]> {
  return {
    accessorKey,
    header,
    enableSorting: sortable,
    filterFn,
    cell: cell ?? ((context) => defaultTextCell(context.getValue())),
  } satisfies ETETableColumn<TData, TData[TKey]>;
}

export function createNumberColumn<TData, TKey extends TableAccessorKey<TData>>({
  accessorKey,
  header,
  sortable = true,
  formatValue,
}: NumberColumnOptions<TData, TKey>): ETETableColumn<TData, number> {
  return {
    accessorKey,
    header,
    enableSorting: sortable,
    cell: ({ getValue }) => defaultNumberCell(getValue(), formatValue),
  } satisfies ETETableColumn<TData, number>;
}

export function createStatusBadgeColumn<TData, TKey extends TableAccessorKey<TData>>({
  accessorKey,
  header,
  sortable = false,
  formatLabel,
  getVariant,
}: StatusBadgeColumnOptions<TData, TKey>): ETETableColumn<TData, TData[TKey]> {
  return {
    accessorKey,
    header,
    enableSorting: sortable,
    cell: ({ getValue }) =>
      renderStatusBadge<TData[TKey]>(getValue() as TData[TKey], formatLabel, getVariant),
  } satisfies ETETableColumn<TData, TData[TKey]>;
}

function defaultTextCell(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function defaultNumberCell(value: unknown, formatValue?: (value: number) => React.ReactNode) {
  if (typeof value !== "number") {
    return "";
  }

  return formatValue ? formatValue(value) : value;
}

function renderStatusBadge<TValue>(
  value: TValue,
  formatLabel?: (value: TValue) => string,
  getVariant?: (value: TValue) => StatusVariant,
) {
  const variant = getVariant?.(value) ?? "neutral";
  const label = formatLabel ? formatLabel(value) : defaultTextCell(value);

  return (
    <StatusBadge label={label} variant={variant} />
  );
}

export function StatusBadge({ label, variant }: { label: React.ReactNode; variant: StatusVariant }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isAnimating, setIsAnimating] = useState(true);
  const { accent, className } = STATUS_VARIANT_STYLES[variant];

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (prefersReducedMotion) {
      setIsAnimating(false);
      return;
    }

    setIsAnimating(true);
    const timeout = setTimeout(() => setIsAnimating(false), 200);

    return () => clearTimeout(timeout);
  }, [label, variant, prefersReducedMotion]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors",
        className,
        isAnimating && "status-change-animate",
      )}
      style={{
        ["--status-accent" as string]: accent,
      }}
      role="status"
      aria-label={typeof label === "string" ? `${label} status` : "Status badge"}
    >
      {label}
    </span>
  );
}
