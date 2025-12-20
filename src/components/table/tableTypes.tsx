"use client";

import React, { useEffect, useState } from "react";
import clsx from "clsx";
import type { CellContext, ColumnDef } from "@tanstack/react-table";

import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

export type ETETableColumn<TData, TValue = any> = ColumnDef<TData, TValue>;

export type TableAccessorKey<TData> = Extract<keyof TData, string>;

const STATUS_VARIANT_CLASSES = {
  success:
    "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-50 dark:ring-emerald-500/60",
  warning:
    "bg-amber-100 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-900/60 dark:text-amber-50 dark:ring-amber-500/60",
  error:
    "bg-rose-100 text-rose-900 ring-1 ring-rose-200 dark:bg-rose-900/60 dark:text-rose-50 dark:ring-rose-500/60",
  info:
    "bg-blue-100 text-blue-900 ring-1 ring-blue-200 dark:bg-blue-900/60 dark:text-blue-50 dark:ring-blue-500/60",
  neutral:
    "bg-slate-100 text-slate-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-50 dark:ring-slate-600",
} as const;

export type StatusVariant = keyof typeof STATUS_VARIANT_CLASSES;

export type TextColumnOptions<TData, TKey extends TableAccessorKey<TData>> = {
  accessorKey: TKey;
  header: string;
  sortable?: boolean;
  cell?: (context: CellContext<TData, TData[TKey]>) => React.ReactNode;
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
}: TextColumnOptions<TData, TKey>): ETETableColumn<TData, TData[TKey]> {
  return {
    accessorKey,
    header,
    enableSorting: sortable,
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

function StatusBadge({ label, variant }: { label: React.ReactNode; variant: StatusVariant }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsAnimating(false);
      return;
    }

    setIsAnimating(true);
    const timeout = setTimeout(() => setIsAnimating(false), 200);

    return () => clearTimeout(timeout);
  }, [label, variant, prefersReducedMotion]);

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize",
        STATUS_VARIANT_CLASSES[variant],
        isAnimating && "status-change-animate",
      )}
    >
      {label}
    </span>
  );
}
