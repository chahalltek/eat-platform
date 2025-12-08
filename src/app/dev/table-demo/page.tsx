"use client";

import Link from "next/link";

import { useDemoTable } from "./useDemoTable";

export default function TableDemoPage() {
  const { table } = useDemoTable();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-12 sm:px-12">
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Dev Playground</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">TanStack Table demo</h1>
          <p className="text-sm text-zinc-600">
            A lightweight integration of TanStack Table with sortable columns and a handful of mock candidates.
          </p>
          <Link href="/" className="text-sm font-semibold text-indigo-700 underline">
            Back to home
          </Link>
        </header>

        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const sortedState = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        colSpan={header.colSpan}
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600"
                      >
                        {header.isPlaceholder ? null : (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className={`flex items-center gap-2 ${header.column.getCanSort() ? "hover:text-indigo-700" : "cursor-default"}`}
                          >
                            <span>{header.column.columnDef.header as string}</span>
                            {sortedState === "asc" && <span aria-label="sorted ascending">↑</span>}
                            {sortedState === "desc" && <span aria-label="sorted descending">↓</span>}
                          </button>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-indigo-50/40">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-4 py-3 text-sm text-zinc-800">
                      {cell.renderValue() as string}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
