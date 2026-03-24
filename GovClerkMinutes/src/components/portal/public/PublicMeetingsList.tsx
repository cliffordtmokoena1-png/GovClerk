import { useRef, useEffect } from "react";
import type { PublicMeetingsListResponse } from "@/types/portal";
import { LuSearch, LuFileText, LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { PublicMeetingRow } from "./PublicMeetingRow";

type Meeting = PublicMeetingsListResponse["meetings"][number];

const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

interface PublicMeetingsListProps {
  meetings: Meeting[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  accentColor?: string;
  isLoading?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  selectedTags?: string[];
  portalSlug?: string;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-16 h-10 bg-gray-200 rounded" />
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex-1">
              <div className="h-5 w-2/3 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-1/4 bg-gray-200 rounded" />
            </div>
            <div className="h-6 w-20 bg-gray-200 rounded-full" />
            <div className="h-5 w-5 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PublicMeetingsList({
  meetings,
  total,
  page,
  pageSize,
  onPageChange,
  accentColor = "#3182CE",
  isLoading,
  searchValue = "",
  onSearchChange,
  selectedTags,
  portalSlug,
}: PublicMeetingsListProps) {
  // Filter meetings by tags if selectedTags is provided
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredMeetings =
    selectedTags && selectedTags.length > 0
      ? meetings.filter((meeting) => meeting.tags?.some((tag) => selectedTags.includes(tag)))
      : meetings;

  const displayTotal = selectedTags && selectedTags.length > 0 ? filteredMeetings.length : total;
  const totalPages = Math.ceil(displayTotal / pageSize);

  return (
    <div>
      {onSearchChange && (
        <div className="mb-4">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search meetings..."
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-20 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <LuSearch
              className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none">
              <kbd className="px-1 py-px text-[10px] font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded">
                {isMac ? "⌘" : "Ctrl"}
              </kbd>
              <kbd className="px-1 py-px text-[10px] font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded">
                K
              </kbd>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* Results count */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">
              {displayTotal > 0 ? (
                <>
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, displayTotal)} of{" "}
                  {displayTotal} meetings
                </>
              ) : (
                "No meetings found"
              )}
            </p>
          </div>

          {/* Empty State */}
          {filteredMeetings.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <LuFileText className="mx-auto h-12 w-12 text-gray-400" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No meetings found</h3>
              <p className="mt-2 text-sm text-gray-500">
                No meetings match your search criteria. Try adjusting your filters.
              </p>
            </div>
          )}

          {filteredMeetings.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {filteredMeetings.map((meeting, index) => (
                <PublicMeetingRow
                  key={meeting.id}
                  meeting={meeting}
                  accentColor={accentColor}
                  isFirst={index === 0}
                  isLast={index === filteredMeetings.length - 1}
                  portalSlug={portalSlug}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav className="mt-6 flex justify-center print:hidden" aria-label="Pagination">
              <ul className="flex items-center gap-1">
                <li>
                  <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 1}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-l-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Previous page"
                  >
                    <LuChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                </li>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .map((p, idx, arr) => {
                    const prevPage = arr[idx - 1];
                    const showEllipsis = prevPage && p - prevPage > 1;

                    return (
                      <li key={p} className="flex items-center">
                        {showEllipsis && <span className="px-2 text-gray-500">...</span>}
                        <button
                          onClick={() => onPageChange(p)}
                          style={
                            p === page
                              ? { backgroundColor: accentColor, borderColor: accentColor }
                              : undefined
                          }
                          className={`px-3 py-2 text-sm font-medium border transition-colors ${
                            p === page
                              ? "text-white"
                              : "text-gray-700 bg-white border-gray-300 hover:bg-gray-50"
                          }`}
                          aria-current={p === page ? "page" : undefined}
                        >
                          {p}
                        </button>
                      </li>
                    );
                  })}

                <li>
                  <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page === totalPages}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Next page"
                  >
                    <LuChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </li>
              </ul>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
