"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { Table } from "@tanstack/react-table";

export type TableFilterOption = { value: string; label: string };

type TableFilterDropdownProps<TData> = {
  table: Table<TData>;
  columnId: string;
  label: string;
  options: TableFilterOption[];
  className?: string;
  emptyLabel?: string;
};

export function TableFilterDropdown<TData>({
  table,
  columnId,
  label,
  options,
  className,
  emptyLabel = "All",
}: TableFilterDropdownProps<TData>) {
  const [open, setOpen] = useState(false);
  const column = table.getColumn(columnId);

  const filterValue = column?.getFilterValue();
  const selectedValues = useMemo(() => {
    if (!column) return [] as string[];
    if (Array.isArray(filterValue)) return filterValue as string[];
    if (typeof filterValue === "string") return filterValue ? [filterValue] : [];
    return [] as string[];
  }, [column, filterValue]);

  const toggleValue = (value: string) => {
    if (!column) return;
    const nextValues = selectedValues.includes(value)
      ? selectedValues.filter((item) => item !== value)
      : [...selectedValues, value];
    column.setFilterValue(nextValues);
  };

  const clear = () => column?.setFilterValue([]);

  const summary = selectedValues.length ? `${selectedValues.length} selected` : emptyLabel;
  const buttonLabel = `${label}: ${summary}`;

  if (!column) return null;

  return (
    <div className={clsx("relative", className)}>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300"
        aria-expanded={open}
        aria-label={buttonLabel}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="text-slate-600">{label}: </span>
        <span>{summary}</span>
      </button>

      {open ? (
        <div className="absolute z-10 mt-2 min-w-[220px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between pb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <button
              type="button"
              className="text-xs font-semibold text-indigo-600 underline"
              onClick={clear}
            >
              Clear
            </button>
          </div>
          <div className="flex max-h-48 flex-col gap-2 overflow-y-auto" role="listbox">
            {options.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm text-slate-800" role="option">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={selectedValues.includes(option.value)}
                  onChange={() => toggleValue(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

