"use client";

import { useState } from "react";

const DIRECTION_LABELS = {
  UP: { emoji: "👍", label: "Good match" },
  DOWN: { emoji: "👎", label: "Not a fit" },
} as const;

type FeedbackDirection = keyof typeof DIRECTION_LABELS;
type FeedbackOutcome = "INTERVIEWED" | "HIRED";

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

  const submitFeedback = async (payload: { direction?: FeedbackDirection; outcome?: FeedbackOutcome }) => {
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
      <p className="font-semibold text-gray-700">Feedback</p>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(DIRECTION_LABELS) as FeedbackDirection[]).map((direction) => (
          <button
            key={direction}
            type="button"
            disabled={disabled}
            onClick={() => submitFeedback({ direction })}
            className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 font-semibold shadow-sm transition hover:border-blue-200 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={`${DIRECTION_LABELS[direction].label} for ${candidateName}`}
          >
            <span aria-hidden>{DIRECTION_LABELS[direction].emoji}</span>
            <span>{DIRECTION_LABELS[direction].label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          { outcome: "INTERVIEWED", label: "Interviewed" },
          { outcome: "HIRED", label: "Hired" },
        ] satisfies { outcome: FeedbackOutcome; label: string }[]).map(({ outcome, label }) => (
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
