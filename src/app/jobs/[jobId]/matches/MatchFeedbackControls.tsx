"use client";

import { useState } from "react";

const OUTCOME_OPTIONS = [
  { outcome: "SCREENED", label: "Screened" },
  { outcome: "INTERVIEWED", label: "Interviewed" },
  { outcome: "OFFERED", label: "Offered" },
  { outcome: "HIRED", label: "Hired" },
  { outcome: "REJECTED", label: "Rejected" },
] as const;

type FeedbackOutcome = (typeof OUTCOME_OPTIONS)[number]["outcome"];

type FeedbackState = "idle" | "saving" | "saved" | "error";

export function MatchFeedbackControls({
  matchId,
  candidateName,
}: {
  matchId: string;
  candidateName: string;
}) {
  const [state, setState] = useState<FeedbackState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const submitFeedback = async (payload: { outcome: FeedbackOutcome }) => {
    setState("saving");
    setMessage(null);

    try {
      const response = await fetch("/api/match-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, ...payload }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Unable to record feedback");
      }

      setState("saved");
      setMessage("Feedback saved");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to record feedback");
    }
  };

  const disabled = state === "saving";

  return (
    <div className="space-y-2 text-xs text-gray-800">
      <p className="font-semibold text-gray-700">Hiring outcome</p>

      <div className="flex flex-wrap gap-2">
        {OUTCOME_OPTIONS.map(({ outcome, label }) => (
          <button
            key={outcome}
            type="button"
            disabled={disabled}
            onClick={() => submitFeedback({ outcome })}
            className="rounded border border-gray-200 bg-gray-50 px-2 py-1 font-semibold text-gray-800 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={`${label} outcome for ${candidateName}`}
          >
            {label}
          </button>
        ))}
      </div>

      {state === "saving" ? <p className="text-gray-500">Saving…</p> : null}
      {message ? <p className={state === "error" ? "text-red-600" : "text-green-700"}>{message}</p> : null}
    </div>
  );
}
