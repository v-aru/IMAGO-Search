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

// Build a short excerpt of suchtext centered around the first query token match.
// Anchoring to the earliest match (rather than the highest-scoring one) tends to
// surface the subject of the image rather than a restriction tag at the end.
function buildHighlight(suchtext: string, queryTokens: string[]): string {
  if (!queryTokens.length) return suchtext.slice(0, 120);
  const lower = suchtext.toLowerCase();
  let bestIdx = -1;
  for (const token of queryTokens) {
    const idx = lower.indexOf(token);
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx;
  }
  if (bestIdx === -1) return suchtext.slice(0, 120);
  // Give 30 chars of context before the match so the hit doesn't appear at col 0
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

  // --- Candidate scoring via the inverted index ---
  // For each query token we do two passes:
  //   1. Exact match — full score from the posting list
  //   2. Prefix match — 60% of the posting list score, to support partial typing
  //      (e.g. "Muell" still surfaces "Mueller"). This is O(V) over vocabulary
  //      which is acceptable for 10k items; at scale a trie or search engine
  //      handles prefix lookup in O(log V) or better.
  // Scores accumulate across tokens, so a document matching two query terms
  // outranks one matching only one.
  let scored: Map<number, number>;

  if (queryTokens.length > 0) {
    scored = new Map();
    for (const token of queryTokens) {
      const exactMatches = index.get(token);
      if (exactMatches) {
        for (const [id, score] of exactMatches) {
          scored.set(id, (scored.get(id) ?? 0) + score);
        }
      }
      for (const [indexToken, postings] of index) {
        if (indexToken !== token && indexToken.startsWith(token)) {
          for (const [id, score] of postings) {
            scored.set(id, (scored.get(id) ?? 0) + score * 0.6);
          }
        }
      }
    }
  } else {
    // No query — treat all items as equally relevant (score 0) so filters and
    // sorting still work. This powers the "browse all" initial state.
    scored = new Map(items.map((item) => [item.id, 0]));
  }

  // O(1) item lookup by id — avoids re-scanning the items array for every candidate
  const itemById = new Map<number, ProcessedMediaItem>(items.map((i) => [i.id, i]));

  // --- Post-filter ---
  // Filtering happens after scoring (not before) so relevance scores are preserved.
  // Credit is an exact match because the values come from a controlled dropdown.
  // Date comparison works correctly on ISO strings ("2020-01-01" < "2024-12-31").
  // Restrictions use "hasAll" semantics: selecting multiple chips narrows results
  // to items that carry every selected restriction, not any of them.
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
  // Date sorts use localeCompare on ISO strings — lexicographic order is correct
  // for YYYY-MM-DD without needing to parse into Date objects.
  // Relevance sort uses date as a tiebreaker so equal-scoring results are still
  // deterministic and biased toward recency.
  if (sort === "datum_asc") {
    candidates.sort((a, b) => a.item.datumIso.localeCompare(b.item.datumIso));
  } else if (sort === "datum_desc") {
    candidates.sort((a, b) => b.item.datumIso.localeCompare(a.item.datumIso));
  } else {
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
