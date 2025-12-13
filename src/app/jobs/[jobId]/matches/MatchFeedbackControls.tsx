"use client";

import { useState } from "react";

const FEEDBACK_OPTIONS = [
  { value: "positive", label: "Good match", icon: "👍" },
  { value: "negative", label: "Poor match", icon: "👎" },
] as const;

type FeedbackValue = (typeof FEEDBACK_OPTIONS)[number]["value"];

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
  const [selection, setSelection] = useState<FeedbackValue | null>(null);

  const submitFeedback = async (feedback: FeedbackValue) => {
    setState("saving");
    setMessage(null);
    setSelection(feedback);

    try {
      const response = await fetch("/api/match-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, feedback }),
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
      <p className="font-semibold text-gray-700">Recruiter feedback</p>

      <div className="flex flex-wrap gap-2">
        {FEEDBACK_OPTIONS.map(({ value, label, icon }) => {
          const isSelected = selection === value && state === "saved";

          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => void submitFeedback(value)}
              className={`flex items-center gap-2 rounded border px-2 py-1 font-semibold shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-60 ${isSelected ? "border-blue-300 bg-blue-50 text-blue-800" : "border-gray-200 bg-gray-50 text-gray-800"}`}
              aria-label={`${label} for ${candidateName}`}
            >
              <span aria-hidden>{icon}</span>
              {label}
            </button>
          );
        })}
      </div>

      {state === "saving" ? <p className="text-gray-500">Saving…</p> : null}
      {message ? <p className={state === "error" ? "text-red-600" : "text-green-700"}>{message}</p> : null}
    </div>
  );
}
