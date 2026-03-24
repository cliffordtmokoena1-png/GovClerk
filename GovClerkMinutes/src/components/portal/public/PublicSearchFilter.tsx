import { useState, useCallback } from "react";
import type { MeetingsFilter } from "@/hooks/portal/usePublicPortal";

interface PublicSearchFilterProps {
  filter: MeetingsFilter;
  onFilterChange: (updates: Partial<MeetingsFilter>) => void;
  onClearFilters: () => void;
  accentColor?: string;
}

export function PublicSearchFilter({
  filter,
  onFilterChange,
  onClearFilters,
  accentColor = "#3182CE",
}: PublicSearchFilterProps) {
  const [searchInput, setSearchInput] = useState(filter.search ?? "");

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onFilterChange({ search: searchInput || undefined });
    },
    [searchInput, onFilterChange]
  );

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  }, []);

  const handleDateChange = useCallback(
    (field: "startDate" | "endDate") => (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ [field]: e.target.value || undefined });
    },
    [onFilterChange]
  );

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFilterChange({ sortBy: e.target.value as "newest" | "oldest" });
    },
    [onFilterChange]
  );

  const hasActiveFilters = filter.search || filter.startDate || filter.endDate;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 print:hidden">
      <form onSubmit={handleSearchSubmit} className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <label htmlFor="meeting-search" className="sr-only">
            Search meetings
          </label>
          <input
            id="meeting-search"
            type="text"
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Search meetings by title or description..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent transition-shadow text-sm"
            style={{ "--tw-ring-color": accentColor } as React.CSSProperties}
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          {/* Date Range */}
          <div className="flex flex-wrap gap-3">
            <div>
              <label htmlFor="start-date" className="block text-xs font-medium text-gray-600 mb-1">
                From Date
              </label>
              <input
                id="start-date"
                type="date"
                value={filter.startDate ?? ""}
                onChange={handleDateChange("startDate")}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent text-sm"
                style={{ "--tw-ring-color": accentColor } as React.CSSProperties}
              />
            </div>
            <div>
              <label htmlFor="end-date" className="block text-xs font-medium text-gray-600 mb-1">
                To Date
              </label>
              <input
                id="end-date"
                type="date"
                value={filter.endDate ?? ""}
                onChange={handleDateChange("endDate")}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent text-sm"
                style={{ "--tw-ring-color": accentColor } as React.CSSProperties}
              />
            </div>
          </div>

          {/* Sort */}
          <div>
            <label htmlFor="sort-by" className="block text-xs font-medium text-gray-600 mb-1">
              Sort By
            </label>
            <select
              id="sort-by"
              value={filter.sortBy ?? "newest"}
              onChange={handleSortChange}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent text-sm bg-white"
              style={{ "--tw-ring-color": accentColor } as React.CSSProperties}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-2 ml-auto">
            <button
              type="submit"
              style={{ backgroundColor: accentColor }}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Search
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
