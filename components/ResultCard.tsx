"use client";

import { SearchResult } from "@/lib/types";

interface Props {
  item: SearchResult;
  query: string;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const words = query.trim().split(/\s+/).filter(Boolean);
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    pattern.test(part) ? (
      <mark key={i} className="bg-yellow-200 text-gray-900 rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function formatDate(datum: string): string {
  if (!datum) return "—";
  const parts = datum.split(".");
  if (parts.length !== 3) return datum;
  const [dd, mm, yyyy] = parts;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthName = months[parseInt(mm) - 1] ?? mm;
  return `${monthName} ${parseInt(dd)}, ${yyyy}`;
}

export default function ResultCard({ item, query }: Props) {
  const aspectRatio = item.breite && item.hoehe ? (item.breite / item.hoehe).toFixed(2) : null;

  return (
    <article className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
      {/* Image placeholder with correct aspect ratio */}
      <div
        className="w-full bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 overflow-hidden"
        style={{ aspectRatio: aspectRatio ?? "16/9" }}
        aria-hidden="true"
      >
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4-4a2 2 0 012.83 0L14 15m0 0l2-2a2 2 0 012.83 0L20 17M14 8a2 2 0 100-4 2 2 0 000 4z" />
        </svg>
      </div>

      {/* Meta */}
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
            #{item.bildnummer}
          </span>
          <time dateTime={item.datumIso} className="text-xs text-gray-400 shrink-0">
            {formatDate(item.datum)}
          </time>
        </div>

        <p className="text-xs text-gray-500 truncate" title={item.fotografen}>
          {item.fotografen}
        </p>

        {/* Highlighted snippet */}
        <p className="text-sm text-gray-700 leading-snug line-clamp-3">
          {highlightText(item.highlight ?? item.suchtext.slice(0, 150), query)}
        </p>

        {/* Restrictions */}
        {item.restrictions.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1" aria-label="Publication restrictions">
            {item.restrictions.map((r) => (
              <span
                key={r}
                title={r}
                className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full"
              >
                {r.replace(/^PUBLICATIONx/, "").replace(/x/g, " ")}
              </span>
            ))}
          </div>
        )}

        {/* Dimensions */}
        {item.breite > 0 && item.hoehe > 0 && (
          <p className="text-xs text-gray-400">{item.breite} × {item.hoehe}px</p>
        )}
      </div>
    </article>
  );
}
