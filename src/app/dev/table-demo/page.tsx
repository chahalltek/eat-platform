"use client";

import Link from "next/link";

import { StandardTable } from "@/components/table/StandardTable";
import { TableSearchInput } from "@/components/table/TableSearchInput";
import { useDemoTable } from "./useDemoTable";

export default function TableDemoPage() {
  const { columns, data, globalFilterFn } = useDemoTable();

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

        <StandardTable
          data={data}
          columns={columns}
          sorting={{ initialState: [{ id: "score", desc: true }] }}
          filtering={{ globalFilter: { initialState: "" }, globalFilterFn }}
          renderToolbar={(table) => (
            <TableSearchInput table={table} placeholder="Search mock candidates" label="Search" className="w-full md:w-72" />
          )}
        />
      </main>
    </div>
  );
}
