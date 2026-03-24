import { GetServerSideProps } from "next";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { PublicPortalResponse, PublicMeetingsListResponse } from "@/types/portal";
import {
  PublicPortalLayout,
  PublicMeetingsList,
  type MeetingsFilter,
} from "@/components/portal/public";
import { usePublicPortalMeetings } from "@/hooks/portal/usePublicPortal";

interface PublicPortalPageProps {
  settings: PublicPortalResponse["settings"];
  initialMeetings: PublicMeetingsListResponse;
  slug: string;
}

export default function PublicPortalPage({
  settings,
  initialMeetings,
  slug,
}: PublicPortalPageProps) {
  const [useClientData, setUseClientData] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState<MeetingsFilter>({ sortBy: "newest" });
  const [search, setSearch] = useState("");
  const isInitialMount = useRef(true);

  const {
    meetings,
    total,
    page,
    pageSize,
    filter: hookFilter,
    updateFilter,
    clearFilters,
    goToPage,
    isLoading,
  } = usePublicPortalMeetings(useClientData ? slug : undefined);

  // Use SSR data initially, switch to client data when filters change
  const displayMeetings = useClientData ? meetings : initialMeetings.meetings;
  const displayTotal = useClientData ? total : initialMeetings.total;
  const displayPage = useClientData ? page : initialMeetings.page;
  const displayPageSize = useClientData ? pageSize : initialMeetings.pageSize;

  // Compute all meetings for sidebar (using initial data for grouping)
  const allMeetings = useMemo(() => {
    return initialMeetings.meetings;
  }, [initialMeetings.meetings]);

  const handleSidebarFilterChange = useCallback(
    (newFilter: MeetingsFilter) => {
      setSidebarFilter(newFilter);
      setUseClientData(true);

      updateFilter({
        sortBy: newFilter.sortBy,
        year: newFilter.year,
        month: newFilter.month,
        selectedTags: newFilter.selectedTags,
      });
    },
    [updateFilter]
  );

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timeoutId = setTimeout(() => {
      setUseClientData(true);
      updateFilter({ search: search || undefined });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [search, updateFilter]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const handlePageChange = useCallback(
    (newPage: number) => {
      setUseClientData(true);
      goToPage(newPage);
    },
    [goToPage]
  );

  return (
    <PublicPortalLayout
      settings={settings}
      meetings={allMeetings}
      filter={sidebarFilter}
      onFilterChange={handleSidebarFilterChange}
    >
      <PublicMeetingsList
        meetings={displayMeetings}
        total={displayTotal}
        page={displayPage}
        pageSize={displayPageSize}
        onPageChange={handlePageChange}
        accentColor={settings.accentColor}
        isLoading={useClientData && isLoading}
        searchValue={search}
        onSearchChange={handleSearchChange}
        portalSlug={slug}
      />
    </PublicPortalLayout>
  );
}

export const getServerSideProps: GetServerSideProps<PublicPortalPageProps> = async (context) => {
  const { slug } = context.params as { slug: string };
  // Fix: Detect localhost and use http, otherwise respect NEXT_PUBLIC_APP_URL
  const host = context.req.headers.host || "localhost:3000";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${isLocalhost ? "http" : "https"}://${host}`;

  try {
    // Fetch portal settings
    const settingsRes = await fetch(`${baseUrl}/api/public/portal/${slug}`);
    if (!settingsRes.ok) {
      if (settingsRes.status === 404) {
        return { notFound: true };
      }
      throw new Error(`Failed to fetch portal settings: ${settingsRes.status}`);
    }
    const settingsData: PublicPortalResponse = await settingsRes.json();

    // Fetch initial meetings
    const meetingsRes = await fetch(
      `${baseUrl}/api/public/portal/${slug}/meetings?page=1&limit=12&sortBy=newest`
    );
    if (!meetingsRes.ok) {
      throw new Error(`Failed to fetch meetings: ${meetingsRes.status}`);
    }
    const meetingsData: PublicMeetingsListResponse = await meetingsRes.json();

    return {
      props: {
        settings: settingsData.settings,
        initialMeetings: meetingsData,
        slug,
      },
    };
  } catch (error) {
    console.error("Error fetching portal data:", error);
    return { notFound: true };
  }
};
