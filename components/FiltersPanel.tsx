"use client";

interface Props {
  credits: string[];
  restrictions: string[];
  selectedCredit: string;
  dateFrom: string;
  dateTo: string;
  selectedRestrictions: string[];
  sort: string;
  onCreditChange: (val: string) => void;
  onDateFromChange: (val: string) => void;
  onDateToChange: (val: string) => void;
  onRestrictionToggle: (val: string) => void;
  onSortChange: (val: string) => void;
  onReset: () => void;
}

export default function FiltersPanel({
  credits,
  restrictions,
  selectedCredit,
  dateFrom,
  dateTo,
  selectedRestrictions,
  sort,
  onCreditChange,
  onDateFromChange,
  onDateToChange,
  onRestrictionToggle,
  onSortChange,
  onReset,
}: Props) {
  const hasActiveFilters =
    selectedCredit || dateFrom || dateTo || selectedRestrictions.length > 0 || sort !== "relevance";

  return (
    <aside className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Filters</h2>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="text-xs text-blue-600 hover:underline focus:outline-none focus:underline"
          >
            Reset all
          </button>
        )}
      </div>

      {/* Sort */}
      <fieldset>
        <legend className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Sort by date</legend>
        <div className="flex gap-2" role="group" aria-label="Sort order">
          {[
            { value: "relevance", label: "Relevance" },
            { value: "datum_desc", label: "Newest" },
            { value: "datum_asc", label: "Oldest" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSortChange(opt.value)}
              aria-pressed={sort === opt.value}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                sort === opt.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Credit */}
      <div>
        <label htmlFor="credit-select" className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
          Credit / Photographer
        </label>
        <select
          id="credit-select"
          value={selectedCredit}
          onChange={(e) => onCreditChange(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white py-2 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All photographers</option>
          {credits.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Date range */}
      <fieldset>
        <legend className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Date range</legend>
        <div className="space-y-2">
          <div>
            <label htmlFor="date-from" className="sr-only">From date</label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="From date"
            />
          </div>
          <div>
            <label htmlFor="date-to" className="sr-only">To date</label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="To date"
            />
          </div>
        </div>
      </fieldset>

      {/* Restrictions */}
      {restrictions.length > 0 && (
        <fieldset>
          <legend className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
            Restrictions
          </legend>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Publication restrictions">
            {restrictions.map((r) => {
              const active = selectedRestrictions.includes(r);
              // Shorten label for display
              const label = r.replace(/^PUBLICATIONx/, "").replace(/x/g, " ");
              return (
                <button
                  key={r}
                  onClick={() => onRestrictionToggle(r)}
                  aria-pressed={active}
                  title={r}
                  className={`px-2 py-1 rounded-full text-xs font-medium border transition focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                    active
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-400"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
    </aside>
  );
}
