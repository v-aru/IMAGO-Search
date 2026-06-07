# IMAGO Media Search

A lightweight, full-featured media search experience built with Next.js, TypeScript, and Tailwind CSS.

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## High-Level Approach

The app is a Next.js (App Router) project with three layers:

1. **Preprocessing** — on first request, `seed.json` is loaded, normalized, tokenized, and indexed into an in-memory inverted index. This runs once per server process.
2. **Search API** (`GET /api/search`) — queries the inverted index, applies filters, sorts, paginates, and returns scored results in milliseconds.
3. **Frontend** — a React SPA with debounced search input, filters panel, result grid with keyword highlighting, and pagination.

---

## Assumptions

- The seed dataset (10,000 items) fits comfortably in memory for a demo. Production would use an external search engine.
- `fotografen` is always in `IMAGO / AgencyName` format.
- `datum` is always `DD.MM.YYYY`. Items with unparseable dates get an empty `datumIso` and sort to the bottom of date-sorted results.
- Restriction tokens follow the `PUBLICATIONx...` pattern. Items with no such token have no restrictions.
- No authentication, no image thumbnails (no image URLs in seed data), no multi-language stop-word dictionary beyond a minimal German+English set.

---

## Design Decisions

### Search & Relevance

**Tokenization:** Each `suchtext` is lowercased, stripped of punctuation (preserving umlauts and hyphens), split on whitespace, and filtered against a minimal German+English stop-word list. This handles the inconsistent delimiter situation in the seed data.

**Inverted index:** A `Map<token, Map<id, score>>` is built at startup. This gives O(k) lookup per query token where k = posting list size, rather than O(n) full scan.

**Scoring weights:**
| Field | Weight | Rationale |
|-------|--------|-----------|
| `suchtext` | 1.0 | Primary content field |
| `fotografen` | 0.5 | Useful for agency/photographer search |
| `bildnummer` | 0.3 | Exact reference lookups |

**Prefix matching:** For partial queries (e.g. "Muell" for "Müller") we also scan the index for tokens that start with the query token, weighted at 0.6×. This is O(V) where V = vocabulary size, acceptable for 10k items. At scale, a trie or dedicated search engine handles this more efficiently.

**Multi-token queries:** Scores are summed across all query tokens. Items matching more query terms rank higher.

### Preprocessing

What we preprocess (at server startup, not per-request):

1. **Date normalization** — `DD.MM.YYYY` → `YYYY-MM-DD` ISO string for lexicographic sorting and range filtering.
2. **Restriction extraction** — regex `/PUBLICATION[A-Za-z]+(?:x[A-Za-z]+)*/g` pulls publication restriction tokens from `suchtext` into a structured `restrictions[]` array. This enables faceted filtering without parsing `suchtext` on every query.
3. **Tokenization** — stop-word removal reduces index noise and speeds up scoring.
4. **Inverted index construction** — token → posting list built once. Subsequent searches are index lookups, not full scans.

Why build-time (startup) rather than runtime: the data is static; preprocessing once amortizes the cost across all requests and keeps per-request latency low.

### Filtering

Filters are applied as a post-filter pass on the scored candidate set:
- **Credit** — exact string match on `fotografen`
- **Date range** — ISO string comparison on `datumIso`
- **Restrictions** — checks that all selected restriction tokens are present in `item.restrictions`

### Analytics (in-memory)

Tracked per search: query string, response time, result count, timestamp. Aggregated: total searches, average response time, top 20 keywords. Exposed via `GET /api/analytics`. Resets on server restart — production would persist to a database or event stream.

---

## API

### `GET /api/search`

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Keyword query |
| `credit` | string | Exact photographer credit filter |
| `dateFrom` | string | ISO date (YYYY-MM-DD) |
| `dateTo` | string | ISO date (YYYY-MM-DD) |
| `restrictions` | string | Comma-separated restriction tokens |
| `sort` | `relevance` \| `datum_asc` \| `datum_desc` | Sort order |
| `page` | number | Page number (default 1) |
| `pageSize` | number | Results per page (max 100, default 20) |

Response: `{ items, page, pageSize, total, totalPages, timingMs }`

### `GET /api/filters`

Returns `{ credits: string[], restrictions: string[] }` for populating filter dropdowns.

### `GET /api/analytics`

Returns `{ totalSearches, avgResponseTimeMs, topKeywords, recentSearches }`.

---

## Scaling to Millions of Items

The current in-memory approach breaks down at ~100k items (memory pressure, startup latency, no persistence). The path to scale:

1. **Replace the in-memory index with Meilisearch or Elasticsearch.** These engines handle inverted indexing, BM25 relevance scoring, faceted filtering, and prefix matching at millions of documents. The preprocessing step (date normalization, restriction extraction) would still run at ingestion time, storing structured fields alongside the raw text.

2. **Continuous ingestion** — use a queue (Kafka, SQS) to push new/updated media items through the preprocessing pipeline and into the search engine asynchronously. The API layer becomes a thin proxy to the search engine.

3. **Caching** — cache popular queries at the CDN or application layer (Redis). The `GET /api/filters` response changes rarely and should be cached aggressively.

4. **Read replicas** — search engines support replica nodes for horizontal read scaling without write coordination.

5. **SEO** — for organic discoverability: static or ISR-rendered result pages for common queries (e.g. `/search/chelsea-fc`), structured data (JSON-LD `ImageObject`), and sitemap generation from the most-searched terms.

---

## Limitations & What I'd Do Next

- **No real images** — seed data has no image URLs; cards show aspect-ratio-correct placeholders.
- **Prefix matching is O(V)** — at 10k items this is fast, but at scale a trie or the search engine's built-in prefix/fuzzy support is needed.
- **Stop-word list is minimal** — a proper German tokenizer (e.g. `natural` or `lunr` with language plugins) would improve recall on German-language `suchtext`.
- **Analytics resets on restart** — would persist to PostgreSQL or a time-series DB.
- **No tests** — would add unit tests for the tokenizer, scoring logic, and date parser; integration tests for the API routes.
- **No authentication** — the API is open.
- **Deployment** — would deploy to Vercel (static + serverless functions) with the seed JSON bundled in public/. At scale, split into a separate search service.
