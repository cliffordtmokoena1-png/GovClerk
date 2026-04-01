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
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}> {label} </span>
  );
}

function ComplianceBadge({ isCompliant }: { isCompliant: boolean | null }) {
  if (isCompliant === null) return null;
  return isCompliant ? (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
      aria-label="Notice is compliant"
    >
      ✅ Compliant
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
      aria-label="Late notice"
    >
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
    <> ...code omitted for brevity... </>
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