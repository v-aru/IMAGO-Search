interface AnalyticsStore {
  totalSearches: number;
  totalResponseTimeMs: number;
  keywordCounts: Map<string, number>;
  recentSearches: { query: string; timingMs: number; resultsCount: number; timestamp: number }[];
}

const store: AnalyticsStore = {
  totalSearches: 0,
  totalResponseTimeMs: 0,
  keywordCounts: new Map(),
  recentSearches: [],
};

export function recordSearch(query: string, timingMs: number, resultsCount: number) {
  store.totalSearches++;
  store.totalResponseTimeMs += timingMs;

  if (query.trim()) {
    const words = query.trim().toLowerCase().split(/\s+/);
    for (const word of words) {
      store.keywordCounts.set(word, (store.keywordCounts.get(word) ?? 0) + 1);
    }
  }

  store.recentSearches.unshift({ query, timingMs, resultsCount, timestamp: Date.now() });
  if (store.recentSearches.length > 50) store.recentSearches.pop();
}

export function getAnalytics() {
  const avgResponseTimeMs =
    store.totalSearches > 0
      ? Math.round(store.totalResponseTimeMs / store.totalSearches)
      : 0;

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
