"use client";

import { useMemo } from "react";

import type { FilterFn } from "@tanstack/react-table";
import type { EATTableColumn } from "@/components/table/tableTypes";
import { createNumberColumn, createTextColumn } from "@/components/table/tableTypes";

export type DemoCandidate = {
  id: number;
  name: string;
  role: string;
  location: string;
  score: number;
  availability: "Immediate" | "2 weeks" | "1 month";
};

export const demoData: DemoCandidate[] = [
  { id: 1, name: "Alex Rivera", role: "Product Manager", location: "Remote", score: 88, availability: "Immediate" },
  { id: 2, name: "Priya Desai", role: "Data Scientist", location: "Austin, TX", score: 92, availability: "2 weeks" },
  { id: 3, name: "Jordan Smith", role: "Full-stack Engineer", location: "New York, NY", score: 79, availability: "1 month" },
  { id: 4, name: "Taylor Brooks", role: "UX Designer", location: "Chicago, IL", score: 85, availability: "Immediate" },
  { id: 5, name: "Chen Wei", role: "Machine Learning Engineer", location: "San Francisco, CA", score: 94, availability: "2 weeks" },
  { id: 6, name: "Samira Khan", role: "QA Lead", location: "Seattle, WA", score: 81, availability: "1 month" },
];

export function useDemoTable() {
  const columns = useMemo<EATTableColumn<DemoCandidate>[]>(
    () => [
      createTextColumn<DemoCandidate, "name">({
        accessorKey: "name",
        header: "Name",
      }),
      createTextColumn<DemoCandidate, "role">({
        accessorKey: "role",
        header: "Role",
        sortable: false,
      }),
      createTextColumn<DemoCandidate, "location">({
        accessorKey: "location",
        header: "Location",
        sortable: false,
      }),
      {
        ...createNumberColumn<DemoCandidate, "score">({
          accessorKey: "score",
          header: "Fit Score",
        }),
        cell: ({ getValue }) => `${getValue<number>()}%`,
      },
      createTextColumn<DemoCandidate, "availability">({
        accessorKey: "availability",
        header: "Availability",
        sortable: false,
      }),
    ],
    [],
  );

  const globalFilterFn = useMemo<FilterFn<DemoCandidate>>(
    () =>
      (row, _columnId, filterValue) => {
        const query = typeof filterValue === "string" ? filterValue.trim().toLowerCase() : "";
        if (!query) return true;

        const values = [row.original.name, row.original.role, row.original.location, row.original.availability];
        return values.some((value) => value.toLowerCase().includes(query));
      },
    [],
  );

  return { columns, data: demoData, globalFilterFn };
}
