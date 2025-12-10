<<<<<<< ours
import React from "react";

export function EATClientLayout({
  children,
  containerClassName,
}: {
  children: React.ReactNode;
  containerClassName?: string;
}) {
  const containerClasses = `mx-auto max-w-6xl px-6 py-10 space-y-8${
    containerClassName ? ` ${containerClassName}` : ""
  }`;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className={containerClasses}>{children}</div>
    </main>
=======
import clsx from "clsx";
import { PropsWithChildren } from "react";

type EATClientLayoutProps = PropsWithChildren<{
  maxWidthClassName?: string;
  contentClassName?: string;
}>;

export function EATClientLayout({
  children,
  maxWidthClassName = "max-w-6xl",
  contentClassName,
}: EATClientLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className={clsx("mx-auto px-6 py-8", maxWidthClassName, contentClassName)}>{children}</main>
    </div>
>>>>>>> theirs
  );
}
