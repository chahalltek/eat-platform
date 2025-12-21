"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

type Shortcut = {
  label: string;
  href: string;
};

const SHORTCUTS: Shortcut[] = [
  { label: "Intake", href: "/intake" },
  { label: "Upload resumes", href: "/resumes/upload" },
  { label: "Matches", href: "/matches" },
  { label: "Explain", href: "/explain" },
  { label: "Confidence", href: "/confidence" },
  { label: "Shortlist", href: "/shortlist" },
  { label: "Executions", href: "/executions" },
];

export function WorkflowShortcuts({
  currentPath,
  className,
}: {
  currentPath?: string;
  className?: string;
}) {
  const pathname = usePathname();
  const normalizedPath = (currentPath ?? pathname ?? "").split("?")[0];

  return (
    <nav aria-label="Workflow navigation" className={className}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {SHORTCUTS.map((shortcut) => {
          const isActive = shortcut.href === normalizedPath;

          if (isActive) {
            return (
              <span
                key={shortcut.href}
                className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 font-semibold text-indigo-700 shadow-sm"
              >
                {shortcut.label}
              </span>
            );
          }

          return (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className={clsx(
                "inline-flex items-center rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700",
              )}
            >
              {shortcut.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
