"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  createDefaultNodeHealth,
  normalizeNodeHealthResponse,
  type NodeHealth,
  type SystemMapHealthResponse,
} from "@/app/system-map/opsImpact";

type UseSystemMapHealthResult = {
  health: NodeHealth | null;
  isPolling: boolean;
  isUnavailable: boolean;
  lastUpdated: string | null;
};

export function useSystemMapHealth(enabled: boolean, endpoint = "/api/system-map/health"): UseSystemMapHealthResult {
  const [health, setHealth] = useState<NodeHealth | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const errorStreakRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scheduleNext = useCallback((delay: number, poller: () => Promise<void>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      void poller();
    }, delay);
  }, []);

  const poll = useCallback(async () => {
    if (!enabled) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsPolling(true);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        cache: "no-store",
        signal: abortRef.current.signal,
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(`Health request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as SystemMapHealthResponse | unknown;
      const normalized = normalizeNodeHealthResponse(payload);

      setHealth(normalized);
      setLastUpdated(typeof (payload as SystemMapHealthResponse).timestamp === "string" ? (payload as SystemMapHealthResponse).timestamp : new Date().toISOString());
      errorStreakRef.current = 0;
      setIsUnavailable(false);
    } catch (error) {
      console.error("[system-map-health] poll failed", error);
      errorStreakRef.current += 1;
      if (errorStreakRef.current >= 3) {
        setIsUnavailable(true);
      }
    } finally {
      setIsPolling(false);
      const delay = errorStreakRef.current >= 3 ? 60_000 : 15_000;
      scheduleNext(delay, poll);
    }
  }, [enabled, endpoint, scheduleNext]);

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      abortRef.current?.abort();
      errorStreakRef.current = 0;
      setIsUnavailable(false);
      setHealth(null);
      setLastUpdated(null);
      return;
    }

    void poll();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      abortRef.current?.abort();
    };
  }, [enabled, poll]);

  return {
    health: health ?? createDefaultNodeHealth(),
    isPolling,
    isUnavailable,
    lastUpdated,
  };
}
