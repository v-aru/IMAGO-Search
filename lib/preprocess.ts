import path from "path";
import fs from "fs";
import { RawMediaItem, ProcessedMediaItem } from "./types";

// Minimal German+English stop words to reduce noise in the index
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "in", "on", "at", "to", "for",
  "is", "are", "was", "were", "be", "been", "being", "have", "has",
  "had", "do", "does", "did", "will", "would", "could", "should",
  "der", "die", "das", "und", "oder", "in", "im", "an", "am", "zu",
  "für", "mit", "von", "bei", "nach", "aus", "ist", "sind", "war",
  "sein", "haben", "wird", "ich", "er", "sie", "es", "wir", "ihr",
  "ihr", "ein", "eine", "einer", "eines",
]);

/**
 * Parse DD.MM.YYYY → YYYY-MM-DD. Returns empty string if unparseable.
 */
function parseDatum(raw: string): string {
  if (!raw) return "";
  const parts = raw.split(".");
  if (parts.length !== 3) return "";
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return "";
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

/**
 * Normalize and tokenize a text string.
 * Lowercases, strips punctuation (except hyphens inside words), removes stop words.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\säöüß-]/g, " ") // keep word chars, umlauts, hyphens
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, "")) // trim leading/trailing hyphens
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Extract publication restriction tokens from suchtext.
 * e.g. "PUBLICATIONxINxGERxONLY" → "PUBLICATIONxINxGERxONLY"
 * Also extract short country codes (e.g. GER, USA, JPN, FRA, SUI, AUT)
 */
export function extractRestrictions(suchtext: string): string[] {
  if (!suchtext) return [];
  const matches = suchtext.match(/PUBLICATION[A-Za-z]+(?:x[A-Za-z]+)*/g);
  if (!matches) return [];
  return [...new Set(matches)];
}

export type InvertedIndex = Map<string, Map<number, number>>; // token → { id → score }

let _items: ProcessedMediaItem[] | null = null;
let _index: InvertedIndex | null = null;
let _credits: string[] | null = null;
let _restrictions: string[] | null = null;

function buildIndex(items: ProcessedMediaItem[]): InvertedIndex {
  const index: InvertedIndex = new Map();

  function addToIndex(token: string, id: number, score: number) {
    if (!index.has(token)) index.set(token, new Map());
    const existing = index.get(token)!.get(id) ?? 0;
    index.get(token)!.set(id, existing + score);
  }

  for (const item of items) {
    // Tokenize suchtext (weight 1.0)
    for (const token of item.tokens) {
      addToIndex(token, item.id, 1.0);
    }
    // Fotografen tokens (weight 0.5)
    for (const token of tokenize(item.fotografen)) {
      addToIndex(token, item.id, 0.5);
    }
    // Bildnummer exact (weight 0.3) — indexed as a single token
    addToIndex(item.bildnummer, item.id, 0.3);
  }

  return index;
}

/**
 * Load and preprocess all items. Memoized — runs once per server process.
 */
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

  const creditSet = new Set(_items.map((i) => i.fotografen).filter(Boolean));
  _credits = [...creditSet].sort();

  const restrictionSet = new Set(_items.flatMap((i) => i.restrictions));
  _restrictions = [...restrictionSet].sort();

  return { items: _items, index: _index, credits: _credits, restrictions: _restrictions };
}
