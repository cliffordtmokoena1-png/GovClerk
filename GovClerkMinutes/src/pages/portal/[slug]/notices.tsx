import { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useState, useCallback } from "react";
import type { PublicPortalResponse } from "@/types/portal";
import { PublicPortalHeader } from "@/components/portal/public/PublicPortalHeader";
import "@/styles/portal-print.css";

type Props = {
  settings: PublicPortalResponse["settings"];
  slug: string;
  initialNotices: any;
};

type Notice = {
  id: number;
  meetingId: number;
  meetingTitle: string;
  meetingDate: string;
  noticeType: string;
  postedAt: string;
  noticeText: string | null;
  postingLocation: string | null;
  hoursNoticeGiven: number | null;
  isCompliant: boolean | null;
};

const NOTICE_TYPE_LABELS: Record<string, string> = {
  regular: "Regular",
  special: "Special",
  emergency: "Emergency",
  executive_session: "Executive Session",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
};

const NOTICE_TYPE_CLASSES: Record<string, string> = {
  regular: "bg-blue-100 text-blue-800",
  special: "bg-yellow-100 text-yellow-800",
  emergency: "bg-red-100 text-red-800",
  executive_session: "bg-purple-100 text-purple-800",
  cancelled: "bg-gray-100 text-gray-700",
  rescheduled: "bg-orange-100 text-orange-800",
};

function NoticeTypeBadge({ type }: { type: string }) {
  const label = NOTICE_TYPE_LABELS[type] || type;
  const cls = NOTICE_TYPE_CLASSES[type] || "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function ComplianceBadge({ isCompliant }: { isCompliant: boolean | null }) {
  if (isCompliant === null) return null;
  return isCompliant ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800" aria-label="Notice is compliant">
      ✅ Compliant
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800" aria-label="Late notice">
      ⚠️ Late Notice
    </span>
  );
}

export default function NoticesPage({ settings, slug, initialNotices }: Props) {
  const [notices, setNotices] = useState<Notice[]>(initialNotices?.notices || []);
  const [total, setTotal] = useState<number>(initialNotices?.total || 0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const fetchNotices = useCallback(
    async (p: number, upcoming: boolean) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(p),
          pageSize: String(pageSize),
          upcoming: upcoming ? "true" : "false",
        });
        const res = await fetch(`/api/public/portal/${slug}/notices?${params}`);
        if (res.ok) {
          const data = await res.json();
          setNotices(data.notices);
          setTotal(data.total);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [slug, pageSize]
  );

  const handleUpcomingToggle = useCallback(
    (val: boolean) => {
      setUpcomingOnly(val);
      setPage(1);
      fetchNotices(1, val);
    },
    [fetchNotices]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      fetchNotices(newPage, upcomingOnly);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [upcomingOnly, fetchNotices]
  );

  const toggleExpanded = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <Head>
        <title>Public Notices — {settings.pageTitle || "Public Portal"}</title>
        <meta name="description" content="View public meeting notices and Open Meetings Act compliance status." />
      </Head>

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
            <li><Link href={`/portal/${slug}`} className="hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">Portal Home</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-gray-800 font-medium">Public Notices</li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Public Notices</h1>
            <p className="text-gray-600 mt-1">Meeting notices and Open Meetings Act compliance records.</p>
          </div>

          <div className="flex gap-2" role="group" aria-label="Filter notices">
            <button
              type="button"
              onClick={() => handleUpcomingToggle(false)}
              aria-pressed={!upcomingOnly}
              className={`px-4 py-2 text-sm font-medium rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                !upcomingOnly ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-300 hover:bg-gray-50"
              }`}
            >
              All Notices
            </button>
            <button
              type="button"
              onClick={() => handleUpcomingToggle(true)}
              aria-pressed={upcomingOnly}
              className={`px-4 py-2 text-sm font-medium rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                upcomingOnly ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-300 hover:bg-gray-50"
              }`}
            >
              Upcoming Only
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16" role="status" aria-label="Loading notices">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" aria-hidden="true" />
          </div>
        ) : notices.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg font-medium">No notices found</p>
            <p className="text-sm mt-1">Check back later for upcoming meeting notices.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">{total} notice{total !== 1 ? "s" : ""}</p>
            <ul className="space-y-4 list-none" aria-label="Public notices list">
              {notices.map((notice) => {
                const isExpanded = expandedIds.has(notice.id);
                const meetingDateStr = new Date(notice.meetingDate).toLocaleDateString(undefined, {
                  weekday: "long", year: "numeric", month: "long", day: "numeric",
                });
                const postedDateStr = new Date(notice.postedAt).toLocaleString(undefined, {
                  year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                });

                return (
                  <li key={notice.id} className="meeting-card bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="p-4">
                      <div className="flex flex-wrap items-start gap-3 mb-2">
                        <NoticeTypeBadge type={notice.noticeType} />
                        <ComplianceBadge isCompliant={notice.isCompliant} />
                      </div>

                      <Link
                        href={`/portal/${slug}/meetings/${notice.meetingId}`}
                        className="text-lg font-semibold text-gray-900 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                      >
                        {notice.meetingTitle}
                      </Link>
                      <p className="text-sm text-gray-500 mt-0.5">📅 {meetingDateStr}</p>

                      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-sm">
                        <div>
                          <dt className="text-gray-400 text-xs">Notice Posted</dt>
                          <dd className="font-medium text-gray-700">{postedDateStr}</dd>
                        </div>
                        {notice.hoursNoticeGiven !== null && (
                          <div>
                            <dt className="text-gray-400 text-xs">Hours of Advance Notice</dt>
                            <dd className="font-medium text-gray-700">{notice.hoursNoticeGiven} hours</dd>
                          </div>
                        )}
                        {notice.postingLocation && (
                          <div>
                            <dt className="text-gray-400 text-xs">Posted At</dt>
                            <dd className="font-medium text-gray-700">{notice.postingLocation}</dd>
                          </div>
                        )}
                      </dl>

                      {notice.noticeText && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(notice.id)}
                            aria-expanded={isExpanded}
                            aria-controls={`notice-text-${notice.id}`}
                            className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                          >
                            {isExpanded ? "Hide notice text ▲" : "View notice text ▼"}
                          </button>
                          {isExpanded && (
                            <div
                              id={`notice-text-${notice.id}`}
                              className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700 whitespace-pre-wrap"
                            >
                              {notice.noticeText}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {totalPages > 1 && (
              <nav aria-label="Notices pagination" className="mt-8 flex justify-center gap-2">
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
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const { slug } = context.params as { slug: string };
  const host = context.req.headers.host || "localhost:3000";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${isLocalhost ? "http" : "https"}://${host}`;

  try {
    const [settingsRes, noticesRes] = await Promise.all([
      fetch(`${baseUrl}/api/public/portal/${slug}`),
      fetch(`${baseUrl}/api/public/portal/${slug}/notices?page=1&pageSize=20`),
    ]);

    if (!settingsRes.ok) return { notFound: true };
    const settingsData: PublicPortalResponse = await settingsRes.json();
    const initialNotices = noticesRes.ok ? await noticesRes.json() : { notices: [], total: 0 };

    return {
      props: {
        settings: settingsData.settings,
        slug,
        initialNotices,
      },
    };
  } catch {
    return { notFound: true };
  }
};
