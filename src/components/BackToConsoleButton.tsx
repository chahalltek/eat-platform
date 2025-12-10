"use client";

import Link from "next/link";

export function BackToConsoleButton() {
  return (
    <Link
      href="/"
      className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
    >
      Back to Console
    </Link>
  );
}
