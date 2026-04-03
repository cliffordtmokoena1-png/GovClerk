import { GetServerSideProps } from "next";
import { RESERVED_PORTAL_SLUGS } from "@/pages/api/portal/utils/initializePortalSettings";
import Head from "next/head";
import Link from "next/link";
import { useState, useCallback } from "react";
import type { PublicPortalResponse } from "@/types/portal";
import type { MeetingCalendarResponse, CalendarMeeting } from "@/types/publicRecords";
import { PublicPortalHeader } from "@/components/portal/public/PublicPortalHeader";
import { getPortalSessionFromCookieHeader } from "@/portal-auth/portalAuth";

type Props = {
  settings: PublicPortalResponse["settings"];
  slug: string;
  initialCalendar: MeetingCalendarResponse;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type MeetingType = "regular" | "special" | "emergency" | "cancelled";

function getMeetingBadgeClass(meeting: CalendarMeeting): string {
  if (meeting.isCancelled) return "bg-gray-700 text-white";
  return "bg-blue-600 text-white";
}

function getMeetingEmoji(meeting: CalendarMeeting): string {
  if (meeting.isCancelled) return "⚫";
  return "🔵";
}

function ComplianceBadge({ isCompliant }: { isCompliant: boolean | null }) {
  if (isCompliant === null) return null;
  return isCompliant ? (
    <span
      className="inline-flex items-center gap-1 text-xs text-green-700"
      aria-label="Notice compliant"
    >
      ✅ <span>Compliant</span>
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 text-xs text-yellow-700"
      aria-label="Late notice"
    >
      ⚠️ <span>Late Notice</span>
    </span>
  );
}

function buildCalendarGrid(year: number, month: number, meetings: CalendarMeeting[]) {
  // month is 1-indexed
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // Mon=0
  const daysInMonth = lastDay.getDate();

  // Build a map of day -> meetings
  const meetingsByDay = new Map<number, CalendarMeeting[]>();
  for (const meeting of meetings) {
    const d = new Date(meeting.meetingDate);
    const day = d.getUTCDate();
    if (!meetingsByDay.has(day)) meetingsByDay.set(day, []);
    meetingsByDay.get(day)!.push(meeting);
  }

  // Build 6-week grid
  const grid: (number | null)[][] = [];
  let current = 1 - startDow;
  for (let week = 0; week < 6; week++) {
    const row: (number | null)[] = [];
    for (let dow = 0; dow < 7; dow++) {
      row.push(current >= 1 && current <= daysInMonth ? current : null);
      current++;
    }
    grid.push(row);
    if (current > daysInMonth) break;
  }

  return { grid, meetingsByDay };
}

export default function CalendarPage({ settings, slug, initialCalendar }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(initialCalendar.month);
  const [year, setYear] = useState(initialCalendar.year);
  const [calendar, setCalendar] = useState<MeetingCalendarResponse>(initialCalendar);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const fetchCalendar = useCallback(
    async (m: number, y: number) => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/public/portal/${slug}/calendar?month=${m}&year=${y}`);
        if (res.ok) {
          const data: MeetingCalendarResponse = await res.json();
          setCalendar(data);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [slug]
  );

  const handlePrevMonth = useCallback(() => {
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    setMonth(newMonth);
    setYear(newYear);
    fetchCalendar(newMonth, newYear);
  }, [month, year, fetchCalendar]);

  const handleNextMonth = useCallback(() => {
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    setMonth(newMonth);
    setYear(newYear);
    fetchCalendar(newMonth, newYear);
  }, [month, year, fetchCalendar]);

  const { grid, meetingsByDay } = buildCalendarGrid(year, month, calendar.meetings);

  return (
    <>
      <Head>
        <title>Meeting Calendar — {settings.pageTitle || "Public Portal"}</title>
        <meta
          name="description"
          content={`Meeting calendar for ${settings.pageTitle || "our organization"}`}
        />
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
              Meeting Calendar
            </li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Meeting Calendar</h1>
          <div className="flex gap-2">
            <a
              href={`/api/public/portal/${slug}/calendar/feed`}
              aria-label="Subscribe to calendar"
              className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              📅 Subscribe
            </a>
            <a
              href={`/api/public/portal/${slug}/feed`}
              aria-label="RSS Feed"
              className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              📡 RSS
            </a>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label={`Go to previous month`}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            ← Prev
          </button>
          <h2 className="text-xl font-bold text-gray-800" aria-live="polite">
            {MONTHS[month - 1]} {year}
          </h2>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label={`Go to next month`}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            Next →
          </button>
        </div>

        {/* View toggle */}
        <div className="flex gap-2 mb-4" role="group" aria-label="Calendar view">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            aria-pressed={viewMode === "grid"}
            className={`px-4 py-2 text-sm font-medium rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
              viewMode === "grid"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white border-gray-300 hover:bg-gray-50"
            }`}
          >
            Grid View
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            className={`px-4 py-2 text-sm font-medium rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
              viewMode === "list"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white border-gray-300 hover:bg-gray-50"
            }`}
          >
            List View
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16" role="status" aria-label="Loading calendar">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
              aria-hidden="true"
            />
          </div>
        ) : viewMode === "grid" ? (
          // Calendar Grid
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table
              className="w-full table-fixed"
              role="grid"
              aria-label={`Calendar for ${MONTHS[month - 1]} ${year}`}
            >
              <caption className="sr-only">
                {MONTHS[month - 1]} {year} meeting calendar
              </caption>
              <thead>
                <tr>
                  {DAYS.map((day) => (
                    <th
                      key={day}
                      scope="col"
                      className="px-1 py-2 text-xs font-semibold text-gray-500 text-center border-b border-gray-200"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.map((week, wi) => (
                  <tr key={wi}>
                    {week.map((day, di) => {
                      const dayMeetings = day !== null ? meetingsByDay.get(day) || [] : [];
                      return (
                        <td
                          key={di}
                          className={`border border-gray-100 align-top min-h-[80px] p-1 ${day === null ? "bg-gray-50" : ""}`}
                          aria-label={day !== null ? `${MONTHS[month - 1]} ${day}` : ""}
                        >
                          {day !== null && (
                            <>
                              <span className="text-xs font-medium text-gray-600 block mb-1">
                                {day}
                              </span>
                              {dayMeetings.map((meeting) => (
                                <Link
                                  key={meeting.id}
                                  href={`/portal/${slug}/meetings/${meeting.id}`}
                                  className={`block text-xs px-1.5 py-0.5 rounded mb-0.5 truncate focus:outline-none focus:ring-2 focus:ring-blue-500 ${getMeetingBadgeClass(meeting)}`}
                                  title={meeting.title}
                                  aria-label={`${getMeetingEmoji(meeting)} ${meeting.title}${meeting.isCancelled ? " (Cancelled)" : ""}`}
                                >
                                  {getMeetingEmoji(meeting)} {meeting.title}
                                </Link>
                              ))}
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          // List View
          <ul className="space-y-3 list-none" aria-label="Meetings list">
            {calendar.meetings.length === 0 ? (
              <li className="text-center py-16 text-gray-500">
                No meetings scheduled for this month.
              </li>
            ) : (
              calendar.meetings.map((meeting) => {
                const meetingDate = new Date(meeting.meetingDate).toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                });
                return (
                  <li
                    key={meeting.id}
                    className="meeting-card bg-white border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span aria-hidden="true">{getMeetingEmoji(meeting)}</span>
                          <Link
                            href={`/portal/${slug}/meetings/${meeting.id}`}
                            className="text-base font-semibold text-gray-900 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                          >
                            {meeting.title}
                          </Link>
                          {meeting.isCancelled && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              Cancelled
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{meetingDate}</p>
                        {meeting.location && (
                          <p className="text-sm text-gray-500">📍 {meeting.location}</p>
                        )}
                        <div className="mt-1">
                          <ComplianceBadge isCompliant={meeting.isCompliant} />
                        </div>
                      </div>
                      {meeting.hasPublicArtifacts && (
                        <span className="text-xs text-green-700 flex-shrink-0">
                          📄 Documents available
                        </span>
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        )}

        {/* Legend */}
        <div
          className="mt-6 flex flex-wrap gap-4 text-sm text-gray-600"
          aria-label="Calendar legend"
        >
          <span className="flex items-center gap-1">
            <span aria-hidden="true">🔵</span> Regular Meeting
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden="true">⚫</span> Cancelled
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden="true">✅</span> Notice Compliant
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden="true">⚠️</span> Late Notice
          </span>
        </div>
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
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  try {
    const [settingsRes, calRes] = await Promise.all([
      fetch(`${baseUrl}/api/public/portal/${slug}`),
      fetch(`${baseUrl}/api/public/portal/${slug}/calendar?month=${month}&year=${year}`),
    ]);

    if (!settingsRes.ok) {
      return { notFound: true };
    }

    const settingsData: PublicPortalResponse = await settingsRes.json();

    // Require authentication to view calendar
    const session = await getPortalSessionFromCookieHeader(context.req.headers.cookie).catch(
      () => null
    );
    if (!session) {
      return {
        redirect: {
          destination: `/portal/${slug}/sign-in?redirect=/portal/${slug}/calendar`,
          permanent: false,
        },
      };
    }

    const initialCalendar: MeetingCalendarResponse = calRes.ok
      ? await calRes.json()
      : { meetings: [], month, year };

    return {
      props: {
        settings: settingsData.settings,
        slug,
        initialCalendar,
      },
    };
  } catch {
    return { notFound: true };
  }
};
