import { useState, useMemo, useCallback } from "react";
import type { NavLink } from "@/types/portal";
import { PublicPortalLayout, PublicMeetingsList, type MeetingsFilter } from "../public";
import {
  SAMPLE_MEETINGS,
  PREVIEW_PAGE_SIZE,
  filterMeetings,
  paginateMeetings,
} from "./previewData";

interface FormData {
  slug: string;
  pageTitle: string;
  pageDescription: string;
  logoUrl: string;
  headerBgColor: string;
  headerTextColor: string;
  accentColor: string;
  navLinks: NavLink[];
  isEnabled: boolean;
}

interface PortalPreviewProps {
  formData: FormData;
  defaultLogoUrl?: string;
}

export function PortalPreview({ formData, defaultLogoUrl }: PortalPreviewProps) {
  const [filter, setFilter] = useState<MeetingsFilter>({ sortBy: "newest" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const settings = {
    id: 0,
    slug: formData.slug || "preview",
    pageTitle: formData.pageTitle || "Public Records Portal",
    pageDescription: formData.pageDescription || null,
    logoUrl: formData.logoUrl || defaultLogoUrl || null,
    headerBgColor: formData.headerBgColor || "#1e3a5f",
    headerTextColor: formData.headerTextColor || "#ffffff",
    accentColor: formData.accentColor || "#3182ce",
    navLinks: formData.navLinks.filter((l) => l.label && l.url),
  };

  const filteredMeetings = useMemo(
    () => filterMeetings(SAMPLE_MEETINGS, search, filter),
    [search, filter]
  );

  const paginatedMeetings = useMemo(
    () => paginateMeetings(filteredMeetings, page, PREVIEW_PAGE_SIZE),
    [filteredMeetings, page]
  );

  const handleFilterChange = useCallback((newFilter: MeetingsFilter) => {
    setFilter(newFilter);
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Announcement bar */}
      <div className="shrink-0 bg-blue-50 border-b border-blue-200 px-4 py-2 text-center">
        <span className="text-sm text-blue-700">This is a live preview of your configuration</span>
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-auto">
        <PublicPortalLayout
          settings={settings}
          meetings={SAMPLE_MEETINGS}
          filter={filter}
          onFilterChange={handleFilterChange}
        >
          <PublicMeetingsList
            meetings={paginatedMeetings}
            total={filteredMeetings.length}
            page={page}
            pageSize={PREVIEW_PAGE_SIZE}
            onPageChange={setPage}
            accentColor={settings.accentColor}
            searchValue={search}
            onSearchChange={handleSearchChange}
          />
        </PublicPortalLayout>
      </div>
    </div>
  );
}
