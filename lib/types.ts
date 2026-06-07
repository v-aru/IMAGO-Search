export interface RawMediaItem {
  id: number;
  suchtext: string;
  bildnummer: string;
  fotografen: string;
  datum: string; // DD.MM.YYYY
  hoehe: string;
  breite: string;
}

export interface ProcessedMediaItem {
  id: number;
  suchtext: string;
  bildnummer: string;
  fotografen: string;
  datum: string;        // DD.MM.YYYY original
  datumIso: string;     // YYYY-MM-DD normalized
  hoehe: number;
  breite: number;
  tokens: string[];
  restrictions: string[];
}

export interface SearchResult {
  id: number;
  suchtext: string;
  bildnummer: string;
  fotografen: string;
  datum: string;
  datumIso: string;
  hoehe: number;
  breite: number;
  restrictions: string[];
  score: number;
  highlight?: string;
}

export interface SearchResponse {
  items: SearchResult[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  timingMs: number;
}

export interface FiltersResponse {
  credits: string[];
  restrictions: string[];
}
