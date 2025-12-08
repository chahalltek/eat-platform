"use client";

import { useMemo, useState } from "react";
import {
  ColumnDef,
  SortingState,
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

export type DemoCandidate = {
  id: number;
  name: string;
  role: string;
  location: string;
  score: number;
  availability: "Immediate" | "2 weeks" | "1 month";
};

const columnHelper = createColumnHelper<DemoCandidate>();

export const demoColumns = [
  columnHelper.accessor("name", {
    id: "name",
    header: "Name",
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("role", {
    id: "role",
    header: "Role",
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("location", {
    id: "location",
    header: "Location",
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("score", {
    id: "score",
    header: "Fit Score",
    cell: (info) => `${info.getValue()}%`,
    enableSorting: true,
  }),
  columnHelper.accessor("availability", {
    id: "availability",
    header: "Availability",
    cell: (info) => info.getValue(),
    enableSorting: false,
  }),
] satisfies ColumnDef<DemoCandidate, any>[];

export const demoData: DemoCandidate[] = [
  { id: 1, name: "Alex Rivera", role: "Product Manager", location: "Remote", score: 88, availability: "Immediate" },
  { id: 2, name: "Priya Desai", role: "Data Scientist", location: "Austin, TX", score: 92, availability: "2 weeks" },
  { id: 3, name: "Jordan Smith", role: "Full-stack Engineer", location: "New York, NY", score: 79, availability: "1 month" },
  { id: 4, name: "Taylor Brooks", role: "UX Designer", location: "Chicago, IL", score: 85, availability: "Immediate" },
  { id: 5, name: "Chen Wei", role: "Machine Learning Engineer", location: "San Francisco, CA", score: 94, availability: "2 weeks" },
  { id: 6, name: "Samira Khan", role: "QA Lead", location: "Seattle, WA", score: 81, availability: "1 month" },
];

export function useDemoTable() {
  const [sorting, setSorting] = useState<SortingState>([]);

  const data = useMemo(() => demoData, []);

  const table = useReactTable({
    data,
    columns: demoColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return { table, sorting, setSorting };
}
