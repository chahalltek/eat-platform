'use client';

import clsx from "clsx";
import Link from "next/link";
import { PropsWithChildren } from "react";

type ClientActionLinkProps = PropsWithChildren<{
  href: string;
  className?: string;
}>;

export function ClientActionLink({ href, className, children }: ClientActionLinkProps) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700",
        className,
      )}
    >
      {children}
    </Link>
  );
}
