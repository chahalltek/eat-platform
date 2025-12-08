"use client";

import clsx from "clsx";

type TableToolbarProps = {
  children: React.ReactNode;
  className?: string;
};

export function TableToolbar({ children, className }: TableToolbarProps) {
  return (
    <div className={clsx("flex flex-wrap items-center gap-3", className)} role="toolbar">
      {children}
    </div>
  );
}

