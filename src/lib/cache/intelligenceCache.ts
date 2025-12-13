const ONE_HOUR_MS = 60 * 60 * 1000;

export const INTELLIGENCE_CACHE_TTLS = {
  benchmarksMs: 24 * ONE_HOUR_MS,
  forecastsMs: 12 * ONE_HOUR_MS,
  marketSignalsMs: 24 * ONE_HOUR_MS,
  l2QueriesMs: ONE_HOUR_MS,
  copilotEvidenceMs: 2 * ONE_HOUR_MS,
} as const;

type CacheEntry<T> = { value: T; expiresAt: number };

function cloneValue<T>(value: T): T {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

class IntelligenceCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  buildKey(parts: Array<string | number | null | undefined>) {
    return parts.map((part) => (part ?? "∅").toString()).join("::");
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cloneValue(entry.value as T);
  }

  set<T>(key: string, value: T, ttlMs: number) {
    this.cache.set(key, { value: cloneValue(value), expiresAt: Date.now() + ttlMs });
  }

  async getOrCreate<T>(
    keyParts: Array<string | number | null | undefined>,
    ttlMs: number,
    loader: () => Promise<T>,
    { bypassCache = false }: { bypassCache?: boolean } = {},
  ): Promise<T> {
    const key = this.buildKey(keyParts);

    if (!bypassCache) {
      const cached = this.get<T>(key);
      if (cached != null) return cached;
    }

    const value = await loader();
    this.set(key, value, ttlMs);
    return value;
  }

  invalidateByPrefix(prefixParts: Array<string | number | null | undefined>) {
    const prefix = this.buildKey(prefixParts);

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }
}

export const intelligenceCache = new IntelligenceCache();

export const intelligenceCacheKeys = {
  marketSignals: (params: { systemMode?: string | null; roleFamily?: string | null; region?: string | null }) =>
    intelligenceCache.buildKey([
      "market-signals",
      params.systemMode ?? "production",
      params.roleFamily ?? "all-role-families",
      params.region ?? "all-regions",
    ]),
  forecasts: (tenantId: string) => intelligenceCache.buildKey(["forecast", "time-to-fill", tenantId]),
  l2: (question: string, tenantId: string, scopeKey: string) =>
    intelligenceCache.buildKey(["l2", question, tenantId, scopeKey]),
  copilotEvidence: (tenantId: string, scopeKey: string) =>
    intelligenceCache.buildKey(["copilot-evidence", tenantId, scopeKey]),
  benchmarkLatest: () => intelligenceCache.buildKey(["benchmark-release", "latest-published"]),
};

export function invalidateForecastCachesForTenant(tenantId: string) {
  intelligenceCache.invalidateByPrefix(["forecast", "time-to-fill", tenantId]);
  intelligenceCache.invalidateByPrefix(["l2", "RISKIEST_REQS", tenantId]);
  intelligenceCache.invalidateByPrefix(["l2", "SCARCITY_HOTSPOTS", tenantId]);
  intelligenceCache.invalidateByPrefix(["copilot-evidence", tenantId]);
}

export const __testing = {
  clear: () => intelligenceCache.clear(),
};
