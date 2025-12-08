'use client';

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo } from 'react';

export type ConfidenceDetails = {
  dataCompleteness: number;
  skillCoverage: number;
  recency: number;
};

export type JobMatchRow = {
  candidateId: string;
  candidateName: string;
  candidateTitle?: string | null;
  matchScore: number;
  confidence: number;
  explanationSummary: string;
  confidenceDetails?: ConfidenceDetails | null;
};

export type JobMatchesTableProps = {
  data: JobMatchRow[];
};

export function JobMatchesTable({ data }: JobMatchesTableProps) {
  const columns = useMemo<ColumnDef<JobMatchRow>[]>(
    () => [
      {
        accessorKey: 'candidateName',
        header: 'Candidate',
        cell: (info) => info.getValue() as string,
      },
      {
        accessorKey: 'candidateTitle',
        header: 'Title',
      },
      {
        accessorKey: 'matchScore',
        header: 'Match',
        cell: (info) => `${info.getValue()}%`,
      },
      {
        accessorKey: 'confidence',
        header: 'Confidence',
        cell: (info) => {
          const row = info.row.original;
          const details = row.confidenceDetails;

          const tooltip = details
            ? [
                `Data completeness: ${details.dataCompleteness}/40`,
                `Skill coverage: ${details.skillCoverage}/40`,
                `Recency: ${details.recency}/20`,
              ].join(' • ')
            : 'No confidence breakdown available';

          return (
            <span
              className="cursor-help underline decoration-dotted underline-offset-2"
              title={tooltip}
            >
              {info.getValue()}%
            </span>
          );
        },
      },
      {
        accessorKey: 'explanationSummary',
        header: 'Why',
        cell: (info) => (
          <span className="text-sm text-slate-600">
            {info.getValue() as string}
          </span>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="border rounded-lg p-4 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b">
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-3 py-2 font-semibold">
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-4 text-center text-slate-500"
              >
                No matches yet. Run MATCHER to populate results.
              </td>
            </tr>
          )}
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2 align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
