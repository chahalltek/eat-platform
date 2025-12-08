"use client";

import clsx from "clsx";
import type { Table } from "@tanstack/react-table";

type TableSearchInputProps<TData> = {
  table: Table<TData>;
  placeholder?: string;
  label?: string;
  className?: string;
};

export function TableSearchInput<TData>({ table, placeholder, label, className }: TableSearchInputProps<TData>) {
  const value = (table.getState().globalFilter as string | undefined) ?? "";

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    table.setGlobalFilter(event.target.value);
  };

  const clear = () => table.setGlobalFilter("");

  return (
    <label className={clsx("flex w-full flex-col gap-1 text-sm text-slate-700", className)}>
      {label ? <span className="font-medium">{label}</span> : null}
      <div className="relative flex w-full items-center">
        <input
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clear}
            className="absolute right-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
          >
            ×
          </button>
        ) : null}
      </div>
    </label>
  );
}

