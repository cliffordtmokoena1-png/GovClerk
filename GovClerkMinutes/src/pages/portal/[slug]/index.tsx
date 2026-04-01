import { GetServerSideProps } from "next";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import type { PublicPortalResponse, PublicMeetingsListResponse } from "@/types/portal";
import type { PortalAnnouncement } from "@/types/publicRecords";
import {
  PublicPortalLayout,
  PublicMeetingsList,
  type MeetingsFilter,
} from "@/components/portal/public";
import { usePublicPortalMeetings } from "@/hooks/portal/usePublicPortal";
import { useLiveSession } from "@/hooks/portal/useLiveSession";

interface PublicPortalPageProps {
  settings: PublicPortalResponse["settings"];
  initialMeetings: PublicMeetingsListResponse;
  slug: string;
  announcements: PortalAnnouncement[];
  upcomingMeetings: Array<{ id: number; title: string; meetingDate: string }>;
  latestArtifacts: Array<{ id: number; fileName: string; artifactType: string; s3Url: string; meetingId: number | null }>;
}

function AnnouncementsBanner({ announcements, slug }: Readonly<{ announcements: PortalAnnouncement[]; slug: string }>) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem("portal_dismissed_announcements");
      const stored = JSON.parse(raw || "[]");
      if (Array.isArray(stored)) {
        setDismissed(new Set(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const handleDismiss = (id: number) => {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    try {
      localStorage.setItem("portal_dismissed_announcements", JSON.stringify([...next]));
    } catch {
      // ignore
    }
  };

  return (
    <div aria-live="polite" aria-label="Portal announcements">
      {visible.map((a) => {
        const bgClass =
          a.type === "emergency"
            ? "bg-red-50 border-red-400"
            : a.type === "alert"
            ? "bg-yellow-50 border-yellow-400"
            : "bg-blue-50 border-blue-300";
        const textClass =
          a.type === "emergency"
            ? "text-red-900"
            : a.type === "alert"
            ? "text-yellow-900"
            : "text-blue-900";
        return (
          <div key={a.id} className={`border-b px-4 py-3 ${bgClass}`} role="region" aria-label={a.title}>
            <div className="max-w-7xl mx-auto flex items-start justify-between gap-4">
              <div className={`flex-1 text-sm ${textClass}`}>
                <strong>{a.title}</strong>
                {a.body && <span className="ml-2 opacity-80">{a.body}</span>}
              </div>
              <button
                type="button"
                onClick={() => handleDismiss(a.id)}
                aria-label={`Dismiss announcement: ${a.title}`}
                className={`flex-shrink-0 text-lg leading-none ${textClass} hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-current rounded`}
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LiveNowBanner({ slug }: Readonly<{ slug: string }>) {
  const { data } = useLiveSession(slug);

  if (!data?.broadcast) return null;

  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-700 font-bold text-sm uppercase tracking-wide">🔴 LIVE NOW</span>
          </div>
          <span className="text-red-600 text-sm font-medium">{data.broadcast.meeting.title}</span>
        </div>
        <a
          href={`/portal/${slug}/live`}
          className="shrink-0 px-4 py-1.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
        >
          Join Live Meeting
        </a>
      </div>
    </div>
  );
}

export default function PublicPortalPage({
  settings,
  initialMeetings,
  slug,
  announcements,
  upcomingMeetings,
  latestArtifacts,
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
    <>
      <AnnouncementsBanner announcements={announcements} slug={slug} />
      <LiveNowBanner slug={slug} />
      <PublicPortalLayout
      settings={settings}
      meetings={allMeetings}
      filter={sidebarFilter}
      onFilterChange={handleSidebarFilterChange}
    >
      {/* Quick Access Links */}
      <nav aria-label="Quick access links" className="mb-6">
        <ul className="grid grid-cols-2 sm:grid-cols-5 gap-3 list-none">
          {[
            { href: `/portal/${slug}/records`, icon: "🗂️", label: "Public Records" },
            { href: `/portal/${slug}/calendar`, icon: "📅", label: "Meeting Calendar" },
            { href: `/portal/${slug}/request-records`, icon: "📄", label: "Request Records" },
            { href: `/portal/${slug}/notices`, icon: "📢", label: "Notices" },
            { href: `/api/public/portal/${slug}/feed`, icon: "📡", label: "RSS Feed", external: true },
          ].map((link) => (
            <li key={link.label}>
              {link.external ? (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  className="flex flex-col items-center gap-1 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-center w-full"
                >
                  <span className="text-xl" aria-hidden="true">{link.icon}</span>
                  <span className="text-xs font-medium text-gray-700">{link.label}</span>
                </a>
              ) : (
                <Link
                  href={link.href}
                  aria-label={link.label}
                  className="flex flex-col items-center gap-1 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-center"
                >
                  <span className="text-xl" aria-hidden="true">{link.icon}</span>
                  <span className="text-xs font-medium text-gray-700">{link.label}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Upcoming Meetings */}
      {upcomingMeetings.length > 0 && (
        <section aria-label="Upcoming meetings" className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="text-sm font-semibold text-blue-800 mb-3">📅 Upcoming Meetings</h2>
          <ul className="space-y-2 list-none">
            {upcomingMeetings.map((meeting) => (
              <li key={meeting.id} className="flex items-center justify-between gap-2">
                <Link
                  href={`/portal/${slug}/meetings/${meeting.id}`}
                  className="text-sm text-blue-700 hover:text-blue-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded truncate"
                >
                  {meeting.title}
                </Link>
                <span className="text-xs text-blue-600 flex-shrink-0">
                  {new Date(meeting.meetingDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href={`/portal/${slug}/calendar`}
            className="mt-3 inline-block text-xs text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            View full calendar →
          </Link>
        </section>
      )}

      {/* Latest Documents */}
      {latestArtifacts.length > 0 && (
        <section aria-label="Latest public documents" className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">📄 Latest Public Documents</h2>
          <ul className="space-y-2 list-none">
            {latestArtifacts.map((artifact) => (
              <li key={artifact.id} className="flex items-center justify-between gap-2">
                <a
                  href={artifact.s3Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Download ${artifact.fileName}`}
                  className="text-sm text-blue-700 hover:text-blue-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded truncate"
                >
                  {artifact.fileName}
                </a>
                <a
                  href={artifact.s3Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Download ${artifact.fileName}`}
                  className="flex-shrink-0 text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

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
    </>
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

    // Fetch initial meetings, announcements, upcoming meetings, and latest artifacts in parallel
    const [meetingsRes, announcementsRes, upcomingRes, artifactsRes] = await Promise.all([
      fetch(`${baseUrl}/api/public/portal/${slug}/meetings?page=1&limit=12&sortBy=newest`),
      fetch(`${baseUrl}/api/public/portal/${slug}/announcements`).catch(() => null),
      fetch(`${baseUrl}/api/public/portal/${slug}/calendar?month=${new Date().getMonth() + 1}&year=${new Date().getFullYear()}`).catch(() => null),
      fetch(`${baseUrl}/api/public/portal/${slug}/records/search?type=artifact&pageSize=5`).catch(() => null),
    ]);

    if (!meetingsRes.ok) {
      throw new Error(`Failed to fetch meetings: ${meetingsRes.status}`);
    }
    const meetingsData: PublicMeetingsListResponse = await meetingsRes.json();

    const announcements: PortalAnnouncement[] = announcementsRes?.ok
      ? (await announcementsRes.json()).announcements || []
      : [];

    const calendarData = upcomingRes?.ok ? await upcomingRes.json() : null;
    const upcomingMeetings = calendarData?.meetings
      ? calendarData.meetings
          .filter((m: any) => new Date(m.meetingDate) >= new Date())
          .slice(0, 3)
          .map((m: any) => ({ id: m.id, title: m.title, meetingDate: m.meetingDate }))
      : [];

    const artifactsData = artifactsRes?.ok ? await artifactsRes.json() : null;
    const latestArtifacts = artifactsData?.results
      ? artifactsData.results.slice(0, 5).map((r: any) => ({
          id: r.id,
          fileName: r.title,
          artifactType: r.artifactType || "",
          s3Url: r.downloadUrl || "",
          meetingId: r.meetingId || null,
        }))
      : [];

    return {
      props: {
        settings: settingsData.settings,
        initialMeetings: meetingsData,
        slug,
        announcements,
        upcomingMeetings,
        latestArtifacts,
      },
    };
  } catch (error) {
    console.error("Error fetching portal data:", error);
    return { notFound: true };
  }
};
