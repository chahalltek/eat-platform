import React from "react";
import clsx from "clsx";
import type { CellContext, ColumnDef } from "@tanstack/react-table";

export type EATTableColumn<TData, TValue = unknown> = ColumnDef<TData, TValue>;

export type TableAccessorKey<TData> = Extract<keyof TData, string>;

const STATUS_VARIANT_CLASSES = {
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  error: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
  neutral: "bg-gray-100 text-gray-800",
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
}: TextColumnOptions<TData, TKey>): EATTableColumn<TData, TData[TKey]> {
  return {
    accessorKey,
    header,
    enableSorting: sortable,
    cell: cell ?? ((context) => defaultTextCell(context.getValue())),
  } satisfies EATTableColumn<TData, TData[TKey]>;
}

export function createNumberColumn<TData, TKey extends TableAccessorKey<TData>>({
  accessorKey,
  header,
  sortable = true,
  formatValue,
}: NumberColumnOptions<TData, TKey>): EATTableColumn<TData, number> {
  return {
    accessorKey,
    header,
    enableSorting: sortable,
    cell: ({ getValue }) => defaultNumberCell(getValue(), formatValue),
  } satisfies EATTableColumn<TData, number>;
}

export function createStatusBadgeColumn<TData, TKey extends TableAccessorKey<TData>>({
  accessorKey,
  header,
  sortable = false,
  formatLabel,
  getVariant,
}: StatusBadgeColumnOptions<TData, TKey>): EATTableColumn<TData, TData[TKey]> {
  return {
    accessorKey,
    header,
    enableSorting: sortable,
    cell: ({ getValue }) =>
      renderStatusBadge<TData[TKey]>(getValue() as TData[TKey], formatLabel, getVariant),
  } satisfies EATTableColumn<TData, TData[TKey]>;
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
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize",
        STATUS_VARIANT_CLASSES[variant],
      )}
    >
      {label}
    </span>
  );
}
