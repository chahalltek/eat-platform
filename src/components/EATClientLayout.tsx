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
  );
}
