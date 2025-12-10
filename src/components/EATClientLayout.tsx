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
  );
}
