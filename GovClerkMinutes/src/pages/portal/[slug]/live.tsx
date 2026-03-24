import React, { useMemo } from "react";
import { GetServerSideProps } from "next";
import Head from "next/head";
import { LuCalendar, LuClock, LuRadio } from "react-icons/lu";
import type { PublicPortalResponse } from "@/types/portal";
import type { BroadcastWithMeeting, BroadcastTranscriptSegment } from "@/types/broadcast";
import type { MgAgendaItemWithRelations } from "@/types/agenda";
import { PublicPortalHeader } from "@/components/portal/public/PublicPortalHeader";
import { HlsVideoPlayer } from "@/components/broadcast/HlsVideoPlayer";
import { getHlsStreamUrlByBroadcastId } from "@/sophon/config";
import { usePublicLiveBroadcast } from "@/hooks/broadcast/usePublicLiveBroadcast";
import { PublicAgendaList } from "@/components/broadcast/PublicAgendaList";
import { PublicTranscriptView } from "@/components/broadcast/PublicTranscriptView";

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

function LiveStreamPlayer({ broadcastId }: Readonly<{ broadcastId: number }>) {
  const streamUrl = getHlsStreamUrlByBroadcastId(broadcastId);

  return (
    <HlsVideoPlayer
      streamUrl={streamUrl}
      liveLabel="Live"
      waitingMessage="Connecting to stream..."
      waitingSubMessage="This may take a moment"
    />
  );
}

export default function PublicLivePage({
  settings,
  broadcast: initialBroadcast,
  agenda: initialAgenda,
  segments: initialSegments,
  slug,
}: PublicLivePageProps) {
  const { broadcast, agenda, segments } = usePublicLiveBroadcast({
    slug,
    initialBroadcast,
    initialAgenda,
    initialSegments,
  });

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
          <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-700 text-sm font-semibold uppercase">Live Now</span>
            </div>
            <span className="text-red-600 text-sm">This meeting is currently being broadcast</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {broadcast.id && <LiveStreamPlayer broadcastId={broadcast.id} />}

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h1 className="text-xl font-semibold text-gray-900 mb-2">
                  {broadcast.meeting.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
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
                  <p className="mt-3 text-gray-600 text-sm">{broadcast.meeting.description}</p>
                )}
              </div>

              <PublicTranscriptView
                slug={slug}
                broadcastId={broadcast.id}
                initialSegments={segments}
              />
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-4">
                <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="font-medium text-gray-900 text-sm">Meeting Agenda</h2>
                  {broadcast.currentAgendaItemId && (
                    <span className="text-xs text-blue-600 font-medium">In Progress</span>
                  )}
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                  <PublicAgendaList
                    items={agenda}
                    currentAgendaItemId={broadcast.currentAgendaItemId}
                    completedItemIds={completedItemIds}
                  />
                </div>
              </div>
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
