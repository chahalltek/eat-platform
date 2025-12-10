"use client";

import { useEffect, useRef, useState } from "react";

import { computeJobFreshnessScore, freshnessLabel } from "@/lib/matching/freshness";

function formatTimestamp(date?: Date | null) {
  if (!date) return "Unknown";
  return date.toLocaleString();
}

type Props = {
  createdAt: Date;
  updatedAt?: Date | null;
  latestMatchActivity?: Date | null;
};

export function FreshnessIndicator({ createdAt, updatedAt, latestMatchActivity }: Props) {
  const freshness = computeJobFreshnessScore({ createdAt, updatedAt, latestMatchActivity });
  const label = freshnessLabel(freshness.score);

  const styles: Record<
    typeof label,
    { text: string; badge: string; dot: string; caption: string; accent: string }
  > = {
    fresh: {
      text: "Fresh",
      badge: "bg-green-50 ring-1 ring-inset ring-green-100",
      dot: "bg-green-500",
      caption: "text-green-700",
      accent: "rgba(34, 197, 94, 0.26)",
    },
    warm: {
      text: "Warming",
      badge: "bg-amber-50 ring-1 ring-inset ring-amber-100",
      dot: "bg-amber-500",
      caption: "text-amber-700",
      accent: "rgba(245, 158, 11, 0.26)",
    },
    stale: {
      text: "Cooling",
      badge: "bg-gray-100 ring-1 ring-inset ring-gray-200",
      dot: "bg-gray-400",
      caption: "text-gray-700",
      accent: "rgba(107, 114, 128, 0.22)",
    },
  };

  const previousLabel = useRef<typeof label | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (previousLabel.current && previousLabel.current !== label) {
      setIsAnimating(false);
      const raf = requestAnimationFrame(() => setIsAnimating(true));
      const timeout = setTimeout(() => setIsAnimating(false), 900);

      previousLabel.current = label;

      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timeout);
      };
    }

    previousLabel.current = label;
  }, [label]);

  return (
    <div className="space-y-1">
      <div
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${styles[label].badge} ${
          isAnimating ? "status-change-animate" : ""
        }`}
        style={{
          ["--status-accent" as string]: styles[label].accent,
        }}
      >
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${styles[label].dot} ${
            isAnimating ? "status-dot-animate" : ""
          }`}
        />
        <span className="text-gray-900">{freshness.score}</span>
        <span className={`text-xs font-medium ${styles[label].caption}`}>{styles[label].text}</span>
      </div>
      <div className="text-xs text-gray-600">
        Last activity: {formatTimestamp(latestMatchActivity ?? updatedAt ?? createdAt)}
      </div>
    </div>
  );
}
