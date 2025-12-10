import type { ReactNode } from "react";
import clsx from "clsx";

export function EATCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        "flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
    >
      {children}
    </div>
  );
}

