import { GetServerSideProps } from "next";
import { RESERVED_PORTAL_SLUGS } from "@/pages/api/portal/utils/initializePortalSettings";
import Head from "next/head";
import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import type { PublicPortalResponse } from "@/types/portal";
import type { PublicRecordsSearchResponse, PublicRecordsSearchResult } from "@/types/publicRecords";
import { PublicPortalHeader } from "@/components/portal/public/PublicPortalHeader";
import { getPortalSessionFromCookieHeader } from "@/portal-auth/portalAuth";

type Props = {
  settings: PublicPortalResponse["settings"];
  slug: string;
  initialResults: PublicRecordsSearchResponse;
};

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  minutes_pdf: "Minutes (PDF)",
  agenda: "Agenda",
  recordings: "Recording",
  transcripts: "Transcript",
  logo: "Logo",
};

function ResultIcon({ type, artifactType }: { type: string; artifactType?: string }) {
  if (type === "meeting") {
    return <span aria-hidden="true">📅</span>;
  }
  if (artifactType === "minutes_pdf") return <span aria-hidden="true">📝</span>;
  if (artifactType === "agenda") return <span aria-hidden="true">📋</span>;
  if (artifactType === "recordings") return <span aria-hidden="true">🎥</span>;
  return <span aria-hidden="true">📄</span>;
}

function ResultCard({ result, slug }: { result: PublicRecordsSearchResult; slug: string }) {
  const typeLabel =
    result.type === "meeting"
      ? "Meeting"
      : ARTIFACT_TYPE_LABELS[result.artifactType || ""] || "Document";

  const formattedDate = result.date
    ? new Date(result.date).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="meeting-card bg-white border border-gray-200 rounded-lg p-4 flex items-start gap-4 hover:shadow-sm transition-shadow">
      <div className="text-2xl mt-0.5 flex-shrink-0" aria-hidden="true">
        <ResultIcon type={result.type} artifactType={result.artifactType} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            {typeLabel}
          </span>
          {result.type === "meeting" ? (
            <Link
              href={`/portal/${slug}/meetings/${result.meetingId}`}
              className="text-base font-semibold text-gray-900 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              {result.title}
            </Link>
          ) : (
            <span className="text-base font-semibold text-gray-900">{result.title}</span>
          )}
        </div>
        {result.description && (
          <p className="text-sm text-gray-600 mt-1 truncate">{result.description}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">{formattedDate}</p>
      </div>
      {result.downloadUrl && (
        <a
          href={result.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Download ${result.title}`}
          className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          Download
        </a>
      )}
    </div>
  );
}

export default function PublicRecordsPage({ settings, slug, initialResults }: Props) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<PublicRecordsSearchResponse>(initialResults);
  const [isLoading, setIsLoading] = useState(false);
  const [liveRegionMsg, setLiveRegionMsg] = useState("");

  const fetchResults = useCallback(
    async (q: string, type: string, start: string, end: string, p: number) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ page: String(p), pageSize: "20" });
        if (q) params.set("q", q);
        if (type) params.set("type", type);
        if (start) params.set("startDate", start);
        if (end) params.set("endDate", end);
        const res = await fetch(`/api/public/portal/${slug}/records/search?${params}`);
        if (res.ok) {
          const data: PublicRecordsSearchResponse = await res.json();
          setResults(data);
          setLiveRegionMsg(`${data.total} result${data.total !== 1 ? "s" : ""} found`);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [slug]
  );

  // Debounced search
  useEffect(() => {
    const id = setTimeout(() => {
      setPage(1);
      fetchResults(query, typeFilter, startDate, endDate, 1);
    }, 300);
    return () => clearTimeout(id);
  }, [query, typeFilter, startDate, endDate, fetchResults]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      fetchResults(query, typeFilter, startDate, endDate, newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [query, typeFilter, startDate, endDate, fetchResults]
  );

  const totalPages = Math.ceil(results.total / results.pageSize);

  return (
    <>
      <Head>
        <title>Public Records — {settings.pageTitle || "Public Portal"}</title>
        <meta
          name="description"
          content={`Search public records for ${settings.pageTitle || "our organization"}`}
        />
      </Head>

      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-blue-700 focus:rounded focus:shadow"
      >
        Skip to main content
      </a>

      <PublicPortalHeader settings={settings} />

      <main id="main-content" className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
          <ol className="flex items-center gap-2">
            <li>
              <Link
                href={`/portal/${slug}`}
                className="hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              >
                Portal Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-gray-800 font-medium">
              Public Records
            </li>
          </ol>
        </nav>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Public Records</h1>
        <p className="text-gray-600 mb-6">
          {settings.pageTitle || "Our Organization"} — public meeting records and documents
        </p>

        {/* Search bar */}
        <div className="portal-search-bar mb-4">
          <label htmlFor="records-search" className="sr-only">
            Search all public records
          </label>
          <div className="flex gap-2">
            <input
              id="records-search"
              type="search"
              placeholder="Search all public records..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search public records"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-blue-500 text-sm"
            />
            <button
              type="button"
              onClick={() => fetchResults(query, typeFilter, startDate, endDate, 1)}
              aria-label="Submit search"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium transition-colors"
            >
              🔍
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6" role="group" aria-label="Filter results">
          <div>
            <label htmlFor="type-filter" className="sr-only">
              Filter by type
            </label>
            <select
              id="type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-blue-500"
            >
              <option value="">All Types</option>
              <option value="meeting">Meetings</option>
              <option value="artifact">Documents</option>
            </select>
          </div>
          <div>
            <label htmlFor="start-date" className="sr-only">
              Start date
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Filter from date"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="end-date" className="sr-only">
              End date
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="Filter to date"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Quick Links */}
        <section
          aria-label="Quick links"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-8"
        >
          {[
            { href: `/portal/${slug}/calendar`, icon: "📅", label: "Meeting Calendar" },
            { href: `/portal/${slug}`, icon: "📋", label: "Agendas" },
            { href: `/portal/${slug}`, icon: "📝", label: "Minutes" },
            { href: `/portal/${slug}/broadcast`, icon: "🎥", label: "Recordings" },
            { href: `/portal/${slug}/notices`, icon: "📢", label: "Notices" },
            { href: `/portal/${slug}/request-records`, icon: "📄", label: "Request Records" },
          ].map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="flex flex-col items-center gap-1 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-center"
              aria-label={link.label}
            >
              <span className="text-2xl" aria-hidden="true">
                {link.icon}
              </span>
              <span className="text-xs font-medium text-gray-700">{link.label}</span>
            </Link>
          ))}
        </section>

        {/* Subscribe / RSS */}
        <div className="flex flex-wrap gap-3 mb-6">
          <a
            href={`/api/public/portal/${slug}/calendar/feed`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            aria-label="Subscribe to calendar feed"
          >
            📅 Subscribe to Calendar
          </a>
          <a
            href={`/api/public/portal/${slug}/feed`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            aria-label="View RSS feed"
          >
            📡 RSS Feed
          </a>
        </div>

        {/* Live region for screen readers */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {liveRegionMsg}
        </div>

        {/* Results */}
        <section aria-label="Search results" aria-busy={isLoading}>
          {isLoading ? (
            <div className="flex justify-center py-16" role="status" aria-label="Loading results">
              <div
                className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
                aria-hidden="true"
              />
            </div>
          ) : results.results.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg font-medium">No results found</p>
              <p className="text-sm mt-1">Try a different search term or adjust your filters.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">
                {results.total} result{results.total !== 1 ? "s" : ""}
                {results.query ? ` for "${results.query}"` : ""}
              </p>
              <ul className="space-y-3 list-none" aria-label="Search results list">
                {results.results.map((result) => (
                  <li key={`${result.type}-${result.id}`}>
                    <ResultCard result={result} slug={slug} />
                  </li>
                ))}
              </ul>

              {/* Pagination */}
              {totalPages > 1 && (
                <nav
                  aria-label="Search results pagination"
                  className="mt-8 flex justify-center gap-2"
                >
                  <button
                    type="button"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    aria-label="Go to previous page"
                    className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    ← Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-600" aria-current="page">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                    aria-label="Go to next page"
                    className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Next →
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const { slug } = context.params as { slug: string };

  if (RESERVED_PORTAL_SLUGS.has(slug)) {
    return { notFound: true };
  }

  const host = context.req.headers.host || "localhost:3000";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${isLocalhost ? "http" : "https"}://${host}`;

  try {
    const [settingsRes, searchRes] = await Promise.all([
      fetch(`${baseUrl}/api/public/portal/${slug}`),
      fetch(`${baseUrl}/api/public/portal/${slug}/records/search?pageSize=20`),
    ]);

    if (!settingsRes.ok) {
      return settingsRes.status === 404 ? { notFound: true } : { notFound: true };
    }

    const settingsData: PublicPortalResponse = await settingsRes.json();

    // Require authentication to view records
    const session = await getPortalSessionFromCookieHeader(context.req.headers.cookie).catch(
      () => null
    );
    if (!session) {
      return {
        redirect: {
          destination: `/portal/${slug}/sign-in?redirect=/portal/${slug}/records`,
          permanent: false,
        },
      };
    }

    const initialResults: PublicRecordsSearchResponse = searchRes.ok
      ? await searchRes.json()
      : { results: [], total: 0, page: 1, pageSize: 20, query: "" };

    return {
      props: {
        settings: settingsData.settings,
        slug,
        initialResults,
      },
    };
  } catch {
    return { notFound: true };
  }
};
