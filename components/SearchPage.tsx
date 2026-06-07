"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import SearchBar from "./SearchBar";
import FiltersPanel from "./FiltersPanel";
import ResultCard from "./ResultCard";
import Pagination from "./Pagination";
import { SearchResponse, FiltersResponse } from "@/lib/types";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const PAGE_SIZE = 24;

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [credit, setCredit] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>([]);
  const [sort, setSort] = useState("relevance");
  const [page, setPage] = useState(1);

  const [results, setResults] = useState<SearchResponse | null>(null);
  const [filters, setFilters] = useState<FiltersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, 300);
  const abortRef = useRef<AbortController | null>(null);

  // Load filter options once
  useEffect(() => {
    fetch("/api/filters")
      .then((r) => r.json())
      .then(setFilters)
      .catch(() => {});
  }, []);

  const doSearch = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      q: debouncedQuery,
      sort,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (credit) params.set("credit", credit);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (selectedRestrictions.length > 0) params.set("restrictions", selectedRestrictions.join(","));

    try {
      const res = await fetch(`/api/search?${params}`, { signal: controller.signal });
      if (!res.ok) throw new Error("Search request failed");
      const data: SearchResponse = await res.json();
      setResults(data);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Something went wrong. Please try again.");
        setResults(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery, credit, dateFrom, dateTo, selectedRestrictions, sort, page]);

  useEffect(() => {
    doSearch();
  }, [doSearch]);

  // Reset to page 1 when filters/query change
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, credit, dateFrom, dateTo, selectedRestrictions, sort]);

  const handleRestrictionToggle = (r: string) => {
    setSelectedRestrictions((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  };

  const handleReset = () => {
    setQuery("");
    setCredit("");
    setDateFrom("");
    setDateTo("");
    setSelectedRestrictions([]);
    setSort("relevance");
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4-4a2 2 0 012.83 0L14 15m0 0l2-2a2 2 0 012.83 0L20 17M14 8a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-900">IMAGO</span>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-500 hidden sm:block">Media Search</span>
          </div>
          <div className="flex-1">
            <SearchBar value={query} onChange={setQuery} isLoading={isLoading} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats bar */}
        {results && !isLoading && (
          <div className="flex items-center justify-between mb-4 text-sm text-gray-500">
            <span>
              <span className="font-medium text-gray-800">{results.total.toLocaleString()}</span> results
              {debouncedQuery && (
                <> for <span className="font-medium text-gray-800">"{debouncedQuery}"</span></>
              )}
            </span>
            <span className="text-xs text-gray-400">{results.timingMs}ms</span>
          </div>
        )}

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-64 shrink-0 hidden lg:block">
            <FiltersPanel
              credits={filters?.credits ?? []}
              restrictions={filters?.restrictions ?? []}
              selectedCredit={credit}
              dateFrom={dateFrom}
              dateTo={dateTo}
              selectedRestrictions={selectedRestrictions}
              sort={sort}
              onCreditChange={setCredit}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              onRestrictionToggle={handleRestrictionToggle}
              onSortChange={setSort}
              onReset={handleReset}
            />
          </div>

          {/* Results */}
          <div className="flex-1 min-w-0">
            {/* Mobile filters */}
            <div className="lg:hidden mb-4">
              <FiltersPanel
                credits={filters?.credits ?? []}
                restrictions={filters?.restrictions ?? []}
                selectedCredit={credit}
                dateFrom={dateFrom}
                dateTo={dateTo}
                selectedRestrictions={selectedRestrictions}
                sort={sort}
                onCreditChange={setCredit}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
                onRestrictionToggle={handleRestrictionToggle}
                onSortChange={setSort}
                onReset={handleReset}
              />
            </div>

            {/* Error state */}
            {error && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center gap-3">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
                </svg>
                <span>{error}</span>
                <button onClick={doSearch} className="ml-auto text-sm underline focus:outline-none">Retry</button>
              </div>
            )}

            {/* Loading skeleton */}
            {isLoading && !results && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true" aria-label="Loading results">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm animate-pulse">
                    <div className="bg-gray-200 rounded-lg w-full h-40 mb-3" />
                    <div className="h-3 bg-gray-200 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-full mb-1" />
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!isLoading && !error && results?.items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400" role="status">
                <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <p className="text-lg font-medium text-gray-600">No results found</p>
                <p className="text-sm mt-1">Try adjusting your search or removing filters</p>
                <button onClick={handleReset} className="mt-4 text-sm text-blue-600 hover:underline focus:outline-none">
                  Clear all filters
                </button>
              </div>
            )}

            {/* Results grid */}
            {results && results.items.length > 0 && (
              <>
                <div
                  className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 transition-opacity ${isLoading ? "opacity-50" : "opacity-100"}`}
                  aria-live="polite"
                  aria-label="Search results"
                >
                  {results.items.map((item) => (
                    <ResultCard key={item.id} item={item} query={debouncedQuery} />
                  ))}
                </div>
                <Pagination
                  page={results.page}
                  totalPages={results.totalPages}
                  total={results.total}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
