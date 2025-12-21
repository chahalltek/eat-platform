"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-700 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
        <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden />
        <span>Nothing to show yet</span>
      </div>
      <div>
        <p className="text-lg font-semibold text-slate-900">{title}</p>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function ErrorStatePanel({
  title,
  message,
  diagnosticsHref = "/agents/logs",
  onRetry,
  errorDetails,
}: {
  title: string;
  message: string;
  diagnosticsHref?: string;
  onRetry?: () => void;
  errorDetails?: string;
}) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const handleCopy = useCallback(() => {
    if (!errorDetails && !message) return;
    if (!navigator?.clipboard?.writeText) {
      setCopyStatus("error");
      return;
    }

    navigator.clipboard
      .writeText(errorDetails ?? message)
      .then(() => setCopyStatus("copied"))
      .catch(() => setCopyStatus("error"));
  }, [errorDetails, message]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-1 h-2.5 w-2.5 rounded-full bg-rose-500" aria-hidden />
        <div className="space-y-1">
          <p className="text-base font-semibold text-rose-900">{title}</p>
          <p className="text-sm leading-relaxed text-rose-800">{message}</p>
          {errorDetails ? (
            <pre className="max-h-40 overflow-auto rounded-md bg-rose-100 px-3 py-2 text-xs text-rose-900">{errorDetails}</pre>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-700">
            <Link
              href={diagnosticsHref}
              className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] text-rose-800 shadow-sm transition hover:border-rose-300 hover:text-rose-900"
            >
              View diagnostics
            </Link>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-semibold text-rose-800 shadow-sm transition hover:border-rose-300 hover:text-rose-900"
            >
              {copyStatus === "copied" ? "Copied" : copyStatus === "error" ? "Copy failed" : "Copy diagnostics"}
            </button>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-rose-700"
              >
                Retry
              </button>
            ) : null}
          </div>
          {copyStatus === "error" ? <p className="text-[11px] text-rose-700">Clipboard unavailable. Copy manually.</p> : null}
        </div>
      </div>
    </div>
  );
}