import { getProcessedData, tokenize } from "./preprocess";
import { ProcessedMediaItem, SearchResult, SearchResponse } from "./types";
import { recordSearch } from "./analytics";

export interface SearchParams {
  q?: string;
  credit?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  restrictions?: string; // comma-separated restriction tokens
  sort?: "datum_asc" | "datum_desc" | "relevance";
  page?: number;
  pageSize?: number;
}

function buildHighlight(suchtext: string, queryTokens: string[]): string {
  if (!queryTokens.length) return suchtext.slice(0, 120);
  const lower = suchtext.toLowerCase();
  let bestIdx = -1;
  for (const token of queryTokens) {
    const idx = lower.indexOf(token);
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx;
  }
  if (bestIdx === -1) return suchtext.slice(0, 120);
  const start = Math.max(0, bestIdx - 30);
  const end = Math.min(suchtext.length, start + 150);
  const snippet = (start > 0 ? "…" : "") + suchtext.slice(start, end) + (end < suchtext.length ? "…" : "");
  return snippet;
}

export function search(params: SearchParams): SearchResponse {
  const start = performance.now();

  const { items, index } = getProcessedData();
  const {
    q = "",
    credit,
    dateFrom,
    dateTo,
    restrictions,
    sort = "relevance",
    page = 1,
    pageSize = 20,
  } = params;

  const queryTokens = tokenize(q);
  const restrictionFilter = restrictions
    ? restrictions.split(",").map((r) => r.trim()).filter(Boolean)
    : [];

  // --- Score candidates via inverted index ---
  let scored: Map<number, number>;

  if (queryTokens.length > 0) {
    scored = new Map();
    for (const token of queryTokens) {
      // Exact token match
      const exactMatches = index.get(token);
      if (exactMatches) {
        for (const [id, score] of exactMatches) {
          scored.set(id, (scored.get(id) ?? 0) + score);
        }
      }
      // Prefix match for partial queries (slightly lower weight)
      for (const [indexToken, postings] of index) {
        if (indexToken !== token && indexToken.startsWith(token)) {
          for (const [id, score] of postings) {
            scored.set(id, (scored.get(id) ?? 0) + score * 0.6);
          }
        }
      }
    }
  } else {
    // No query — all items are candidates with score 0
    scored = new Map(items.map((item) => [item.id, 0]));
  }

  // Build a lookup for fast item access
  const itemById = new Map<number, ProcessedMediaItem>(items.map((i) => [i.id, i]));

  // --- Filter ---
  let candidates = [...scored.entries()]
    .map(([id, score]) => ({ item: itemById.get(id)!, score }))
    .filter(({ item }) => {
      if (!item) return false;

      if (credit && item.fotografen !== credit) return false;

      if (dateFrom && item.datumIso && item.datumIso < dateFrom) return false;
      if (dateTo && item.datumIso && item.datumIso > dateTo) return false;

      if (restrictionFilter.length > 0) {
        const hasAll = restrictionFilter.every((r) => item.restrictions.includes(r));
        if (!hasAll) return false;
      }

      return true;
    });

  // --- Sort ---
  if (sort === "datum_asc") {
    candidates.sort((a, b) => a.item.datumIso.localeCompare(b.item.datumIso));
  } else if (sort === "datum_desc") {
    candidates.sort((a, b) => b.item.datumIso.localeCompare(a.item.datumIso));
  } else {
    // Relevance: higher score first, then newest
    candidates.sort((a, b) =>
      b.score !== a.score
        ? b.score - a.score
        : b.item.datumIso.localeCompare(a.item.datumIso)
    );
  }

  const total = candidates.length;
  const totalPages = Math.ceil(total / pageSize);
  const offset = (page - 1) * pageSize;
  const pageItems = candidates.slice(offset, offset + pageSize);

  const resultItems: SearchResult[] = pageItems.map(({ item, score }) => ({
    id: item.id,
    suchtext: item.suchtext,
    bildnummer: item.bildnummer,
    fotografen: item.fotografen,
    datum: item.datum,
    datumIso: item.datumIso,
    hoehe: item.hoehe,
    breite: item.breite,
    restrictions: item.restrictions,
    score,
    highlight: buildHighlight(item.suchtext, queryTokens),
  }));

  const timingMs = Math.round(performance.now() - start);
  recordSearch(q, timingMs, total);

  return { items: resultItems, page, pageSize, total, totalPages, timingMs };
}
