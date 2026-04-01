import React, { useMemo, useState } from "react";
import { GetServerSideProps } from "next";
import Head from "next/head";
import { LuCalendar, LuClock, LuRadio } from "react-icons/lu";
import type { PublicPortalResponse } from "@/types/portal";
import type { BroadcastWithMeeting, BroadcastTranscriptSegment } from "@/types/broadcast";
import type { MgAgendaItemWithRelations } from "@/types/agenda";
import { PublicPortalHeader } from "@/components/portal/public/PublicPortalHeader";
import { PublicLiveAgenda } from "@/components/portal/public/PublicLiveAgenda";
import { PublicMotionsPanel } from "@/components/portal/public/PublicMotionsPanel";
import { PublicSpeakerQueue } from "@/components/portal/public/PublicSpeakerQueue";
import { PublicCommentForm } from "@/components/portal/public/PublicCommentForm";
import { PublicLiveCaptions } from "@/components/portal/public/PublicLiveCaptions";
import { PublicStreamEmbed } from "@/components/portal/public/PublicStreamEmbed";
import { useLiveSession } from "@/hooks/portal/useLiveSession";
import type { LiveSessionResponse } from "@/types/liveSession";

interface LiveBroadcastResponse {
  broadcast: BroadcastWithMeeting | null;
  agenda: MgAgendaItemWithRelations[];
  segments: BroadcastTranscriptSegment[];
}

interface PublicLivePageProps {
  settings: PublicPortalResponse["settings"];
  broadcast: BroadcastWithMeeting | null;
  agenda: MgAgendaItemWithRelations[];
  segments: BroadcastTranscriptSegment[];
  slug: string;
}

type ActiveTab = "agenda" | "motions" | "speakers" | "comment" | "captions";

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function flattenAgenda(items: any[]): { id: number; title: string }[] {
  const result: { id: number; title: string }[] = [];
  for (const item of items) {
    if (!item.isSection) {
      result.push({ id: item.id, title: item.title });
    }
    if (item.children?.length) {
      result.push(...flattenAgenda(item.children));
    }
  }
  return result;
}

export default function PublicLivePage({
  settings,
  broadcast: initialBroadcast,
  agenda: initialAgenda,
  segments: initialSegments,
  slug,
}: PublicLivePageProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("agenda");
  const { data: liveData } = useLiveSession(slug);

  // Use live data if available, else fall back to SSR initial data
  const broadcast = liveData?.broadcast ?? initialBroadcast;
  const agenda = (liveData?.agenda ?? initialAgenda) as any[];
  const segments = liveData?.segments ?? initialSegments;
  const streamConfig = liveData?.streamConfig ?? null;
  const motions = liveData?.motions ?? [];
  const speakerQueue = liveData?.speakerQueue ?? [];
  const publicCommentQueue = liveData?.publicCommentQueue ?? [];

  const completedItemIds = useMemo(() => {
    if (!broadcast?.agendaTimestamps) {
      return new Set<number>();
    }
    const completed = new Set<number>();
    for (const ts of broadcast.agendaTimestamps) {
      if (Number(ts.agendaItemId) !== Number(broadcast.currentAgendaItemId)) {
        completed.add(Number(ts.agendaItemId));
      }
    }
    return completed;
  }, [broadcast?.agendaTimestamps, broadcast?.currentAgendaItemId]);

  const flatAgendaItems = useMemo(() => flattenAgenda(agenda), [agenda]);

  const tabs: { id: ActiveTab; label: string; count?: number }[] = [
    { id: "agenda", label: "Agenda" },
    { id: "motions", label: "Motions & Voting", count: motions.length || undefined },
    { id: "speakers", label: "Speaker Queue", count: speakerQueue.length || undefined },
    { id: "comment", label: "Public Comment" },
    { id: "captions", label: "Live Captions", count: segments.length || undefined },
  ];

  const pageTitle = settings.pageTitle ?? "Live Meeting";

  if (!broadcast) {
    return (
      <>
        <Head>
          <title>{pageTitle} - No Live Meeting</title>
        </Head>
        <div className="min-h-dvh bg-gray-50 flex flex-col">
          <PublicPortalHeader settings={settings} />
          <main className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <LuRadio className="w-8 h-8 text-gray-400" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">No Live Meeting</h1>
              <p className="text-gray-500 mb-6">
                There is no meeting being broadcast at this time. Please check back later.
              </p>
              <a
                href={`/portal/${slug}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                View Past Meetings
              </a>
            </div>
          </main>
          <footer className="shrink-0 border-t border-gray-200 bg-white py-4">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <p className="text-center text-sm text-gray-500">
                Powered by{" "}
                <a
                  href="https://GovClerkMinutes.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-700"
                >
                  GovClerkMinutes
                </a>{" "}
                · Public Records Portal
              </p>
            </div>
          </footer>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>
          LIVE: {broadcast.meeting.title} - {pageTitle}
        </title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-dvh bg-gray-50 flex flex-col">
        <PublicPortalHeader settings={settings} />

        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
          {/* Live badge */}
          <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-700 text-sm font-semibold uppercase">Live Now</span>
            </div>
            <span className="text-red-600 text-sm">This meeting is currently being broadcast</span>
          </div>

          {/* Top section: stream + meeting info */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2">
              <PublicStreamEmbed streamConfig={streamConfig} />
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h1 className="text-lg font-semibold text-gray-900 mb-2">
                  {broadcast.meeting.title}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-2">
                  <span className="flex items-center gap-1">
                    <LuCalendar className="w-4 h-4" />
                    {formatDate(broadcast.meeting.meetingDate)}
                  </span>
                  <span className="flex items-center gap-1">
                    <LuClock className="w-4 h-4" />
                    {formatTime(broadcast.meeting.meetingDate)}
                  </span>
                </div>
                {broadcast.meeting.description && (
                  <p className="text-gray-600 text-sm">{broadcast.meeting.description}</p>
                )}
              </div>

              {/* Attendance summary */}
              {liveData?.attendance && liveData.attendance.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h2 className="text-sm font-semibold text-gray-700 mb-2">Attendance</h2>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-2xl font-bold text-gray-900">
                      {liveData.attendance.filter((rec) => rec.status === "present" || rec.status === "late").length}
                    </span>
                    <span className="text-gray-500">/ {liveData.attendance.length} present</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex overflow-x-auto border-b border-gray-200">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`px-1.5 py-0.5 text-xs rounded-full ${activeTab === tab.id ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-4">
              {activeTab === "agenda" && (
                <PublicLiveAgenda
                  agenda={agenda}
                  currentAgendaItemId={broadcast.currentAgendaItemId}
                />
              )}

              {activeTab === "motions" && (
                <PublicMotionsPanel motions={motions} />
              )}

              {activeTab === "speakers" && (
                <PublicSpeakerQueue queue={speakerQueue} />
              )}

              {activeTab === "comment" && (
                <PublicCommentForm
                  slug={slug}
                  meetingId={broadcast.meeting.id}
                  agendaItems={flatAgendaItems}
                  approvedComments={publicCommentQueue}
                />
              )}

              {activeTab === "captions" && (
                <PublicLiveCaptions segments={segments} />
              )}
            </div>
          </div>
        </main>

        <footer className="shrink-0 border-t border-gray-200 bg-white py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-gray-500">
              Powered by{" "}
              <a
                href="https://GovClerkMinutes.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-700"
              >
                GovClerkMinutes
              </a>{" "}
              · Public Records Portal
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<PublicLivePageProps> = async (context) => {
  const { slug } = context.params as { slug: string };
  const host = context.req.headers.host || "localhost:3000";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${isLocalhost ? "http" : "https"}://${host}`;

  try {
    const settingsRes = await fetch(`${baseUrl}/api/public/portal/${slug}`);
    if (!settingsRes.ok) {
      if (settingsRes.status === 404) {
        return { notFound: true };
      }
      throw new Error(`Failed to fetch portal settings: ${settingsRes.status}`);
    }
    const settingsData: PublicPortalResponse = await settingsRes.json();

    const broadcastRes = await fetch(`${baseUrl}/api/public/portal/${slug}/live`);
    let broadcastData: LiveBroadcastResponse = { broadcast: null, agenda: [], segments: [] };

    if (broadcastRes.ok) {
      broadcastData = await broadcastRes.json();
    }

    return {
      props: {
        settings: settingsData.settings,
        broadcast: broadcastData.broadcast,
        agenda: broadcastData.agenda || [],
        segments: broadcastData.segments || [],
        slug,
      },
    };
  } catch (error) {
    console.error("Error fetching live page data:", error);
    return { notFound: true };
  }
};
