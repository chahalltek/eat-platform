import { performance } from "node:perf_hooks";

export type TimingInputSizes = Record<string, number | null | undefined>;

export type TimingCacheStatus = {
  hit: boolean;
  cacheName?: string;
  cacheKey?: string;
};

export type TimingMetadata = {
  workload: string;
  inputSizes?: TimingInputSizes;
  cache?: TimingCacheStatus;
  meta?: Record<string, unknown>;
};

export type TimingLogEntry = TimingMetadata & { durationMs: number };

export function recordTiming(entry: TimingLogEntry) {
  const inputSizes = entry.inputSizes ?? {};
  const meta = entry.meta ?? {};

  const payload = {
    event: "performance_timing",
    workload: entry.workload,
    durationMs: Number(entry.durationMs.toFixed(2)),
    inputSizes,
    cache: entry.cache ?? null,
    meta,
    timestamp: new Date().toISOString(),
  } as const;

  console.info(payload);
}

export function startTiming(metadata: TimingMetadata) {
  const startedAt = performance.now();
  let ended = false;

  return {
    end: (overrides: Partial<TimingMetadata> = {}) => {
      if (ended) return;
      ended = true;

      const durationMs = performance.now() - startedAt;
      const inputSizes = { ...(metadata.inputSizes ?? {}), ...(overrides.inputSizes ?? {}) };
      const meta = { ...(metadata.meta ?? {}), ...(overrides.meta ?? {}) };

      recordTiming({ ...metadata, ...overrides, inputSizes, meta, durationMs });
    },
  } as const;
}
