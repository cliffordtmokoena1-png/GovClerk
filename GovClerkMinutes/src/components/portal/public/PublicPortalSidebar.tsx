import { useState, useEffect, useCallback, useMemo } from "react";
import { LuX } from "react-icons/lu";
import type { PublicMeetingsListResponse } from "@/types/portal";
import type { MeetingsFilter } from "@/hooks/portal/usePublicPortal";

type Meeting = PublicMeetingsListResponse["meetings"][number];

export type { MeetingsFilter };

interface MonthGroup {
  year: number;
  month: number;
  label: string;
  count: number;
}

interface PublicPortalSidebarProps {
  meetings: Meeting[];
  filter: MeetingsFilter;
  onFilterChange: (filter: MeetingsFilter) => void;
  isOpen: boolean;
  onClose: () => void;
  accentColor?: string;
}

function getMonthLabel(year: number, month: number): string {
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function groupMeetingsByMonth(meetings: Meeting[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();

  meetings.forEach((meeting) => {
    const date = new Date(meeting.meetingDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = `${year}-${month}`;

    if (!groups.has(key)) {
      groups.set(key, {
        year,
        month,
        label: getMonthLabel(year, month),
        count: 0,
      });
    }
    groups.get(key)!.count++;
  });

  return Array.from(groups.values()).sort((a, b) => {
    if (a.year !== b.year) {
      return b.year - a.year;
    }
    return b.month - a.month;
  });
}

function extractUniqueTags(meetings: Meeting[]): string[] {
  const tagsSet = new Set<string>();
  meetings.forEach((meeting) => {
    meeting.tags?.forEach((tag) => tagsSet.add(tag));
  });
  return Array.from(tagsSet).sort();
}

export function PublicPortalSidebar({
  meetings,
  filter,
  onFilterChange,
  isOpen,
  onClose,
  accentColor = "#3182ce",
}: PublicPortalSidebarProps) {
  const [mounted, setMounted] = useState(false);
  const monthGroups = useMemo(() => groupMeetingsByMonth(meetings), [meetings]);
  const allTags = useMemo(() => extractUniqueTags(meetings), [meetings]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleMonthClick = (group: MonthGroup) => {
    if (filter.year === group.year && filter.month === group.month) {
      // Deselect if clicking the same month
      onFilterChange({ ...filter, year: undefined, month: undefined });
    } else {
      onFilterChange({ ...filter, year: group.year, month: group.month });
    }
  };

  const handleClearFilters = () => {
    onFilterChange({ sortBy: "newest" });
  };

  const handleTagClick = (tag: string) => {
    const currentTags = filter.selectedTags || [];
    const isSelected = currentTags.includes(tag);
    const newTags = isSelected ? currentTags.filter((t) => t !== tag) : [...currentTags, tag];
    onFilterChange({ ...filter, selectedTags: newTags.length > 0 ? newTags : undefined });
  };

  const isTagSelected = (tag: string) => filter.selectedTags?.includes(tag) ?? false;

  const isMonthSelected = (group: MonthGroup) =>
    filter.year === group.year && filter.month === group.month;

  const navContent = (
    <div className="py-4 flex flex-col h-full">
      {/* Sort Options */}
      <div className="px-4 mb-4">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Sort By
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onFilterChange({ ...filter, sortBy: "newest" })}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded border transition-colors ${
              filter.sortBy !== "oldest"
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            Newest
          </button>
          <button
            type="button"
            onClick={() => onFilterChange({ ...filter, sortBy: "oldest" })}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded border transition-colors ${
              filter.sortBy === "oldest"
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            Oldest
          </button>
        </div>
      </div>

      {/* Clear Filters */}
      {(filter.year || filter.month || (filter.selectedTags && filter.selectedTags.length > 0)) && (
        <div className="px-4 mb-4">
          <button
            type="button"
            onClick={handleClearFilters}
            className="w-full px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Filter by Tag */}
      {allTags.length > 0 && (
        <div className="px-4 mb-4">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
            Filter by Tag
          </span>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => {
              const selected = isTagSelected(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagClick(tag)}
                  style={
                    selected
                      ? { backgroundColor: accentColor, borderColor: accentColor }
                      : undefined
                  }
                  className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                    selected
                      ? "text-white"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                  aria-pressed={selected}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Month Navigation */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 mb-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Browse by Month
          </span>
        </div>
        <nav aria-label="Filter by month">
          <ul className="space-y-0.5">
            {monthGroups.map((group) => {
              const selected = isMonthSelected(group);
              return (
                <li key={`${group.year}-${group.month}`}>
                  <button
                    type="button"
                    onClick={() => handleMonthClick(group)}
                    style={
                      selected
                        ? { borderLeftColor: accentColor, backgroundColor: `${accentColor}10` }
                        : undefined
                    }
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors border-l-4 ${
                      selected
                        ? "font-medium text-gray-900"
                        : "border-transparent text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                    aria-pressed={selected}
                  >
                    <span>{group.label}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        selected ? "bg-gray-200 text-gray-800" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {group.count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 print:hidden">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {navContent}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mounted && (
        <div
          className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${
            isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Filter menu"
        >
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-gray-900/50 transition-opacity duration-300 ${
              isOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div
            className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl transform transition-transform duration-300 ease-out flex flex-col ${
              isOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
              <span className="text-sm font-semibold text-gray-900">Filters</span>
              <button
                type="button"
                onClick={onClose}
                className="p-2 -mr-2 text-gray-500 hover:text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close menu"
              >
                <LuX className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto">{navContent}</div>
          </div>
        </div>
      )}
    </>
  );
}
