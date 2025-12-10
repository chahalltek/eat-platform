"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useState } from "react";

type AgentFailureBannerProps = {
  initialCount?: number;
  refreshIntervalMs?: number;
  maxWidthClassName?: string;
};

type FailureResponse = {
  failedRuns?: number;
};

export function AgentFailureBanner({
  initialCount = 0,
  refreshIntervalMs = 5000,
  maxWidthClassName = "max-w-6xl",
}: AgentFailureBannerProps) {
  const [failedRuns, setFailedRuns] = useState(initialCount);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function fetchFailures() {
      try {
        const response = await fetch("/api/agents/failures", { cache: "no-store", signal: controller.signal });

        if (!response.ok) {
          if (response.status === 401) {
            return;
          }
          throw new Error("Failed to load agent failures");
        }

        const payload = (await response.json()) as FailureResponse;
        if (isMounted && typeof payload.failedRuns === "number") {
          setFailedRuns(payload.failedRuns);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("[agent-failure-banner] refresh failed", error);
      }
    }

    fetchFailures();
    const intervalId = setInterval(fetchFailures, refreshIntervalMs);

    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(intervalId);
    };
  }, [refreshIntervalMs]);

  if (failedRuns <= 0) return null;

  const label = failedRuns === 1 ? "1 agent failure detected" : `${failedRuns} agent failures detected`;

  return (
    <div className="border-b border-amber-200 bg-amber-50 text-amber-900" role="alert" aria-live="polite">
      <div className={clsx("mx-auto flex items-center justify-between gap-4 px-6 py-3", maxWidthClassName)}>
        <div className="flex items-center gap-3">
          <span className="text-lg" aria-hidden>
            ⚠
          </span>
          <p className="text-sm font-semibold">{label}</p>
        </div>
        <Link
          href="/agents/logs"
          className="text-sm font-semibold text-amber-900 underline underline-offset-4 hover:text-amber-950"
        >
          View logs →
        </Link>
      </div>
    </div>
  );
}
