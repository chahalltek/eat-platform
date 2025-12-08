"use client";

import { useCallback, useState } from "react";

export type FeatureFlagListItem = {
  name: string;
  description: string | null;
  enabled: boolean;
  updatedAt: string;
};

type FeatureFlagsPanelProps = {
  initialFlags: FeatureFlagListItem[];
};

type FlagUpdateResult = {
  name: string;
  enabled: boolean;
};

async function updateFlag(name: string, enabled: boolean): Promise<FlagUpdateResult> {
  const response = await fetch("/api/feature-flags", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, enabled }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = typeof errorBody.error === "string" ? errorBody.error : "Unable to update flag";
    throw new Error(message);
  }

  const data = (await response.json()) as FlagUpdateResult;
  return data;
}

export function FeatureFlagsPanel({ initialFlags }: FeatureFlagsPanelProps) {
  const [flags, setFlags] = useState<FeatureFlagListItem[]>(() => initialFlags);
  const [savingFlag, setSavingFlag] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = useCallback(async (name: string, currentState: boolean) => {
    setSavingFlag(name);
    setError(null);

    try {
      const nextState = !currentState;

      setFlags((prev) =>
        prev.map((flag) =>
          flag.name === name ? { ...flag, enabled: nextState, updatedAt: new Date().toISOString() } : flag,
        ),
      );

      const result = await updateFlag(name, nextState);

      setFlags((prev) =>
        prev.map((flag) =>
          flag.name === result.name ? { ...flag, enabled: result.enabled, updatedAt: new Date().toISOString() } : flag,
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update flag";
      setError(message);
      setFlags((prev) =>
        prev.map((flag) => (flag.name === name ? { ...flag, enabled: currentState } : flag)),
      );
    } finally {
      setSavingFlag(null);
    }
  }, []);

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-zinc-900">Feature Flags</h2>
        <p className="text-sm text-zinc-600">
          Toggle features on or off without redeploying. Changes apply across the UI and API.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="divide-y divide-zinc-100">
        {flags.map((flag) => {
          const isSaving = savingFlag === flag.name;
          const updatedLabel = new Date(flag.updatedAt).toLocaleString();

          return (
            <div key={flag.name} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-semibold capitalize text-zinc-900">{flag.name}</div>
                <p className="text-sm text-zinc-600">{flag.description ?? "No description"}</p>
                <p className="text-xs text-zinc-500">Last updated {updatedLabel}</p>
              </div>

              <button
                type="button"
                onClick={() => handleToggle(flag.name, flag.enabled)}
                disabled={isSaving}
                className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium shadow-sm transition ${
                  flag.enabled
                    ? "bg-green-600 text-white hover:bg-green-500"
                    : "bg-zinc-200 text-zinc-800 hover:bg-zinc-300"
                } ${isSaving ? "opacity-60" : ""}`}
              >
                {isSaving ? "Saving…" : flag.enabled ? "Enabled" : "Disabled"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
