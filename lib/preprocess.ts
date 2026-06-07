import path from "path";
import fs from "fs";
import { RawMediaItem, ProcessedMediaItem } from "./types";

// A minimal bilingual stop-word list covering the most common German and English
// function words. Removing these reduces the index size and prevents high-frequency
// words (like "und", "in", "the") from drowning out meaningful terms in scoring.
// A production system would use a proper NLP tokenizer (e.g. compromise, natural)
// with a full language-specific stop list.
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "in", "on", "at", "to", "for",
  "is", "are", "was", "were", "be", "been", "being", "have", "has",
  "had", "do", "does", "did", "will", "would", "could", "should",
  "der", "die", "das", "und", "oder", "in", "im", "an", "am", "zu",
  "für", "mit", "von", "bei", "nach", "aus", "ist", "sind", "war",
  "sein", "haben", "wird", "ich", "er", "sie", "es", "wir", "ihr",
  "ihr", "ein", "eine", "einer", "eines",
]);

// Convert DD.MM.YYYY to YYYY-MM-DD so dates are lexicographically sortable and
// comparable with ISO range inputs from the frontend date picker.
// Returns empty string on failure so unparseable dates sort to the bottom rather
// than crashing the request.
function parseDatum(raw: string): string {
  if (!raw) return "";
  const parts = raw.split(".");
  if (parts.length !== 3) return "";
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return "";
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

// Tokenize a free-text string into normalized, indexable terms.
// - Lowercase for case-insensitive matching
// - Keep umlauts (ä ö ü ß) because the corpus is mixed German/English
// - Keep hyphens inside words (e.g. "left-back") but strip leading/trailing ones
//   that appear when punctuation like commas is replaced with spaces
// - Filter single-character tokens: they add index noise without search value
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\säöüß-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

// Restriction tokens follow a consistent machine-generated pattern: PUBLICATIONx
// followed by alternating uppercase segments separated by "x" (e.g. INxGERxONLY).
// Extracting these into a structured array at index-build time means the filter
// path never has to touch the raw suchtext string — it's just an array.includes().
// The Set deduplicates in case the same token appears twice in one suchtext.
export function extractRestrictions(suchtext: string): string[] {
  if (!suchtext) return [];
  const matches = suchtext.match(/PUBLICATION[A-Za-z]+(?:x[A-Za-z]+)*/g);
  if (!matches) return [];
  return [...new Set(matches)];
}

// Inverted index: maps each token to a posting list of { itemId → accumulated score }.
// A Map<number, number> per token (rather than an array of ids) lets us accumulate
// scores for items that appear in multiple posting lists (multi-token queries) with
// a single .set() call instead of scanning an array.
export type InvertedIndex = Map<string, Map<number, number>>;

// Module-level singletons so preprocessing runs once per server process.
// Next.js serverless functions cold-start per request, but in dev and on long-lived
// hosts this cache makes subsequent requests near-instant.
let _items: ProcessedMediaItem[] | null = null;
let _index: InvertedIndex | null = null;
let _credits: string[] | null = null;
let _restrictions: string[] | null = null;

function buildIndex(items: ProcessedMediaItem[]): InvertedIndex {
  const index: InvertedIndex = new Map();

  function addToIndex(token: string, id: number, score: number) {
    if (!index.has(token)) index.set(token, new Map());
    const existing = index.get(token)!.get(id) ?? 0;
    // Accumulate: an item that matches a token in both suchtext and fotografen
    // gets a higher combined score than one that matches in only one field.
    index.get(token)!.set(id, existing + score);
  }

  for (const item of items) {
    // suchtext is the primary content field — highest weight
    for (const token of item.tokens) {
      addToIndex(token, item.id, 1.0);
    }
    // fotografen (credit/agency) is secondary — useful when users search by
    // agency name but shouldn't outrank a strong suchtext match
    for (const token of tokenize(item.fotografen)) {
      addToIndex(token, item.id, 0.5);
    }
    // bildnummer is indexed as a single opaque token for exact lookup.
    // Weight is low because it's an identifier, not a content signal.
    addToIndex(item.bildnummer, item.id, 0.3);
  }

  return index;
}

// Entry point for all search and filter routes.
// Lazy-loads and preprocesses seed.json on first call, then returns the cached result.
// All preprocessing (date parsing, tokenization, restriction extraction, index build)
// happens here so individual request handlers stay thin.
export function getProcessedData(): {
  items: ProcessedMediaItem[];
  index: InvertedIndex;
  credits: string[];
  restrictions: string[];
} {
  if (_items && _index && _credits && _restrictions) {
    return { items: _items, index: _index, credits: _credits, restrictions: _restrictions };
  }

  const filePath = path.join(process.cwd(), "public", "seed.json");
  const raw: RawMediaItem[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  _items = raw.map((item) => {
    const datumIso = parseDatum(item.datum);
    const tokens = tokenize(item.suchtext);
    const restrictions = extractRestrictions(item.suchtext);
    return {
      id: item.id,
      suchtext: item.suchtext,
      bildnummer: item.bildnummer,
      fotografen: item.fotografen ?? "",
      datum: item.datum,
      datumIso,
      hoehe: parseInt(item.hoehe) || 0,
      breite: parseInt(item.breite) || 0,
      tokens,
      restrictions,
    };
  });

  _index = buildIndex(_items);

  // Pre-sort credits alphabetically so the dropdown is consistent without
  // needing to sort on every filter request.
  const creditSet = new Set(_items.map((i) => i.fotografen).filter(Boolean));
  _credits = [...creditSet].sort();

  const restrictionSet = new Set(_items.flatMap((i) => i.restrictions));
  _restrictions = [...restrictionSet].sort();

  return { items: _items, index: _index, credits: _credits, restrictions: _restrictions };
}
