"use client";

import Link from "next/link";

export function BackToConsoleButton() {
  return (
    <Link
      href="/"
      className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
    >
      Back to Console
    </Link>
  );
}
