"use client";

import clsx from "clsx";
import { useState } from "react";

import { ClientActionLink } from "@/components/ClientActionLink";

type FailureActionsProps = {
  runId: string;
  agentName: string;
  runHref: string;
  diagnosticsHref: string;
};

const RETRY_KEYWORDS = ["RINA", "RUA", "OUTREACH"];

function supportsRetry(agentName: string) {
  const normalized = agentName.toUpperCase();
  return RETRY_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function FailureActions({ runId, agentName, runHref, diagnosticsHref }: FailureActionsProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const retryAllowed = supportsRetry(agentName);

  const handleRetry = async () => {
    if (!retryAllowed || submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/agents/runs/${runId}/retry`, { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok) {
        const errorMessage =
          typeof payload.message === "string"
            ? payload.message
            : typeof payload.error === "string"
              ? payload.error
              : "Unable to re-run this agent.";
        throw new Error(errorMessage);
      }

      const retryCount = typeof payload.retryCount === "number" ? payload.retryCount : null;
      setNotice(retryCount ? `Re-run started (retry ${retryCount}).` : "Re-run started with the same inputs.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to re-run this agent.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <ClientActionLink href={runHref}>Review failure</ClientActionLink>
        <ClientActionLink href={diagnosticsHref}>View diagnostics</ClientActionLink>
        <button
          type="button"
          onClick={handleRetry}
          disabled={!retryAllowed || submitting}
          title={retryAllowed ? undefined : "Re-run is not available in this environment."}
          className={clsx(
            "inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition",
            retryAllowed
              ? "border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50"
              : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500",
          )}
        >
          {submitting ? "Re-running…" : "Re-run with same inputs"}
        </button>
      </div>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {notice ? <p className="text-xs text-emerald-700">{notice}</p> : null}
    </div>
  );
}
