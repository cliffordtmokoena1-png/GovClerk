import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { LuRadio, LuCalendar, LuLoader2 } from "react-icons/lu";
import MgHead from "@/components/MgHead";
import { OrgDashboardLayout } from "@/components/org-dashboard/OrgDashboardLayout";
import { ContentSpinner } from "@/components/org-dashboard/content/ContentSpinner";
import { BroadcastDashboard, ConfirmDialog } from "@/components/broadcast";
import { Button } from "@/components/ui/button";
import { useBroadcast } from "@/hooks/broadcast/useBroadcast";
import { useOrgContext } from "@/contexts/OrgContext";
import useSWR from "swr";
import type { PortalMeeting } from "@/types/portal";

interface MeetingsResponse {
  meetings: PortalMeeting[];
  total: number;
}

const meetingsFetcher = async (url: string): Promise<MeetingsResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch meetings");
  }
  return response.json();
};

function SelectMeetingView() {
  const { orgId } = useOrgContext();
  const { startBroadcast, checkExistingSegments } = useBroadcast();
  const [isStarting, setIsStarting] = useState<number | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingMeetingId, setPendingMeetingId] = useState<number | null>(null);
  const [segmentCount, setSegmentCount] = useState(0);

  const { data: meetingsData, isLoading } = useSWR<MeetingsResponse>(
    orgId ? `/api/portal/meetings?orgId=${orgId}&pageSize=50` : null,
    meetingsFetcher
  );

  const upcomingMeetings = useMemo(() => {
    if (!meetingsData?.meetings) {
      return [];
    }
    const now = new Date();
    return meetingsData.meetings
      .filter((meeting) => {
        const meetingDate = new Date(meeting.meetingDate);
        return meetingDate > now;
      })
      .sort((a, b) => new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime())
      .slice(0, 3);
  }, [meetingsData]);

  const doStartBroadcast = async (meetingId: number) => {
    setIsStarting(meetingId);
    try {
      await startBroadcast(meetingId);
    } catch (err) {
      console.error("Failed to start broadcast:", err);
    } finally {
      setIsStarting(null);
    }
  };

  const handleStartBroadcast = async (meetingId: number) => {
    setIsStarting(meetingId);
    try {
      const { hasExistingSegments, segmentCount: count } = await checkExistingSegments(meetingId);

      if (hasExistingSegments) {
        setSegmentCount(count);
        setPendingMeetingId(meetingId);
        setShowConfirmDialog(true);
        setIsStarting(null);
        return;
      }

      await doStartBroadcast(meetingId);
    } catch (err) {
      console.error("Failed to check segments:", err);
      setIsStarting(null);
    }
  };

  const handleConfirmStart = async () => {
    setShowConfirmDialog(false);
    if (pendingMeetingId) {
      await doStartBroadcast(pendingMeetingId);
    }
    setPendingMeetingId(null);
  };

  const handleCancelConfirm = () => {
    setShowConfirmDialog(false);
    setPendingMeetingId(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return <ContentSpinner message="Loading meetings..." />;
  }

  const confirmDescription = (
    <>
      This meeting has <strong>{segmentCount}</strong> existing transcript segment
      {segmentCount !== 1 ? "s" : ""} from a previous broadcast. Starting a new broadcast will{" "}
      <strong>permanently delete</strong> all previous transcript data.
    </>
  );

  return (
    <>
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <LuRadio className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Start a Broadcast</h2>
            <p className="text-muted-foreground">Select a meeting to broadcast live</p>
          </div>

          {upcomingMeetings.length === 0 ? (
            <div className="text-center py-8 bg-muted/50 rounded-xl border border-border">
              <LuCalendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground mb-4">No upcoming meetings found</p>
              <Link href="/a/meetings" className="text-primary hover:underline text-sm">
                Go to Meetings
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="p-4 bg-card rounded-xl border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">{meeting.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(meeting.meetingDate)} at {formatTime(meeting.meetingDate)}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleStartBroadcast(meeting.id)}
                      disabled={isStarting === meeting.id}
                      className="ml-4"
                    >
                      {isStarting === meeting.id ? (
                        <LuLoader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <LuRadio className="w-4 h-4" />
                      )}
                      Setup Broadcast
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={handleCancelConfirm}
        title="Start New Broadcast?"
        description={confirmDescription}
        confirmLabel="Start Broadcast"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={handleConfirmStart}
        isLoading={isStarting !== null}
      />
    </>
  );
}

function NotOwnerView({ ownerName }: Readonly<{ ownerName?: string }>) {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 flex items-center justify-center">
          <LuRadio className="w-8 h-8 text-orange-600" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Broadcast in Progress</h2>
        <p className="text-muted-foreground mb-6">
          A live meeting is currently being broadcast by {ownerName || "another user"}. Please
          contact them if you need to manage this broadcast.
        </p>
        <Button variant="secondary" asChild>
          <Link href="/a/meetings">Back to Meetings</Link>
        </Button>
      </div>
    </div>
  );
}

export default function BroadcastPage() {
  const { isLoaded } = useAuth();
  const { mode, orgId } = useOrgContext();
  const { broadcast, isOwner, ownerName, isLoading } = useBroadcast();

  if (!isLoaded || isLoading) {
    return (
      <>
        <MgHead title="Broadcast" />
        <OrgDashboardLayout title="Broadcast">
          <ContentSpinner message="Loading broadcast..." />
        </OrgDashboardLayout>
      </>
    );
  }

  if (mode !== "org" || !orgId) {
    return (
      <>
        <MgHead title="Broadcast" />
        <OrgDashboardLayout title="Broadcast">
          <div className="flex items-center justify-center h-full p-8 text-center text-muted-foreground">
            Broadcast is only available for organizations.
          </div>
        </OrgDashboardLayout>
      </>
    );
  }

  if (!broadcast) {
    return (
      <>
        <MgHead title="Start Broadcast" />
        <OrgDashboardLayout title="Broadcast">
          <SelectMeetingView />
        </OrgDashboardLayout>
      </>
    );
  }

  if (!isOwner) {
    return (
      <>
        <MgHead title="Broadcast in Progress" />
        <OrgDashboardLayout title="Broadcast">
          <NotOwnerView ownerName={ownerName} />
        </OrgDashboardLayout>
      </>
    );
  }

  return (
    <>
      <MgHead title={`Broadcasting: ${broadcast.meeting.title}`} />
      <OrgDashboardLayout fullWidth>
        <BroadcastDashboard
          initialBroadcast={broadcast}
          isOwner={isOwner}
          ownerName={ownerName}
          orgId={orgId}
        />
      </OrgDashboardLayout>
    </>
  );
}
