interface AnalyticsStore {
  totalSearches: number;
  totalResponseTimeMs: number;
  keywordCounts: Map<string, number>;
  recentSearches: { query: string; timingMs: number; resultsCount: number; timestamp: number }[];
}

// Module-level store — lives for the lifetime of the server process.
// In production this would be flushed to a database or event stream (e.g. Kafka)
// so data survives restarts and scales across multiple instances.
const store: AnalyticsStore = {
  totalSearches: 0,
  totalResponseTimeMs: 0,
  keywordCounts: new Map(),
  recentSearches: [],
};

export function recordSearch(query: string, timingMs: number, resultsCount: number) {
  store.totalSearches++;
  store.totalResponseTimeMs += timingMs;

  // Only count non-empty queries for keyword frequency — empty queries represent
  // "browse all" sessions and would pollute the top-keywords list.
  if (query.trim()) {
    const words = query.trim().toLowerCase().split(/\s+/);
    for (const word of words) {
      store.keywordCounts.set(word, (store.keywordCounts.get(word) ?? 0) + 1);
    }
  }

  // Prepend so recentSearches[0] is always the latest.
  // Cap at 50 entries to bound memory usage without needing eviction logic.
  store.recentSearches.unshift({ query, timingMs, resultsCount, timestamp: Date.now() });
  if (store.recentSearches.length > 50) store.recentSearches.pop();
}

export function getAnalytics() {
  const avgResponseTimeMs =
    store.totalSearches > 0
      ? Math.round(store.totalResponseTimeMs / store.totalSearches)
      : 0;

  // Sort descending by count and slice to top 20 — enough signal without returning
  // the full vocabulary to the client.
  const topKeywords = [...store.keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([keyword, count]) => ({ keyword, count }));

  return {
    totalSearches: store.totalSearches,
    avgResponseTimeMs,
    topKeywords,
    recentSearches: store.recentSearches.slice(0, 10),
  };
}
