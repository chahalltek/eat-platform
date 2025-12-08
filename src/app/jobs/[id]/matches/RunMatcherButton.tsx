"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

type RunMatcherButtonProps = {
  jobId: string;
};

export function RunMatcherButton({ jobId }: RunMatcherButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = useCallback(async () => {
    setError(null);
    setIsRunning(true);

    try {
      const response = await fetch(`/api/jobs/${jobId}/matcher`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Matcher request failed with ${response.status}`);
      }

      const payload = (await response.json()) as { agentRunId?: string };
      setLastRunId(payload.agentRunId ?? null);

      startTransition(() => router.refresh());
    } catch (err) {
      console.error("Matcher run failed", err);
      setError("Could not run matcher. Please try again.");
    } finally {
      setIsRunning(false);
    }
  }, [jobId, router]);

  return (
    <div className="flex flex-col items-start gap-2 text-sm sm:flex-row sm:items-center sm:gap-3">
      <button
        type="button"
        onClick={handleRun}
        disabled={isRunning || isPending}
        className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
      >
        {isRunning || isPending ? "Running matcher..." : "Run matcher"}
      </button>
      {lastRunId && (
        <span className="text-xs text-gray-600">Last run ID: {lastRunId}</span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
