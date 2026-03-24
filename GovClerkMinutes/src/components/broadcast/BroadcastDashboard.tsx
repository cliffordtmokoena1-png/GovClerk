import React, { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { toast } from "sonner";
import { LuRadio, LuCalendar, LuClock, LuUsers, LuX } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { useBroadcast } from "@/hooks/broadcast/useBroadcast";
import { useAgenda } from "@/hooks/portal/useAgenda";
import { useMotions } from "@/hooks/portal/useMotions";
import { usePortalSettings } from "@/hooks/portal/usePortalSettings";
import { useOrgAppBarTitle } from "@/components/org-dashboard/context/OrgAppBarContext";
import { useOrgSidebar } from "@/components/org-dashboard/hooks/useOrgSidebar";
import { BroadcastStreamView, BroadcastSetupGuide } from "./BroadcastStreamView";
import { BroadcastTranscriptNotesPanel } from "./BroadcastTranscriptNotesPanel";
import { BroadcastAgendaPanel } from "./BroadcastAgendaPanel";
import { BroadcastQuickActions } from "./BroadcastQuickActions";
import { BroadcastDocumentsPanel } from "./BroadcastDocumentsPanel";
import { ConfirmDialog } from "./ConfirmDialog";
import { getSophonHttpUrl } from "@/sophon/config";
import type { BroadcastWithMeeting } from "@/types/broadcast";
import type { MgAgendaItemWithRelations } from "@/types/agenda";

function findAgendaItemById(
  items: MgAgendaItemWithRelations[],
  targetId: number
): MgAgendaItemWithRelations | null {
  for (const item of items) {
    if (item.id === targetId) {
      return item;
    }
    if (item.children && item.children.length > 0) {
      const found = findAgendaItemById(item.children, targetId);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

type Props = {
  initialBroadcast: BroadcastWithMeeting;
  isOwner: boolean;
  ownerName?: string;
  orgId: string;
};

export function BroadcastDashboard({
  initialBroadcast,
  isOwner,
  ownerName,
  orgId,
}: Readonly<Props>) {
  const router = useRouter();
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const { collapseSidebar } = useOrgSidebar();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Use the hook without meetingId to share SWR cache with parent page
  const {
    broadcast: liveBroadcast,
    goLive,
    pauseBroadcast,
    endBroadcast,
    deleteBroadcast,
    setCurrentAgendaItem,
    updateNotes,
  } = useBroadcast();

  // Use live data if available, otherwise fallback to initial prop
  const broadcast = liveBroadcast ?? initialBroadcast;
  const [currentNotes, setCurrentNotes] = useState(broadcast.notes || "");
  const [isStreamAvailable, setIsStreamAvailable] = useState(false);

  // Set app bar title
  useOrgAppBarTitle(`Broadcast - ${broadcast.meeting.title}`);

  // Collapse sidebar on mount for more screen space
  useEffect(() => {
    collapseSidebar();
  }, [collapseSidebar]);

  const { tree, mutate: mutateAgenda } = useAgenda(broadcast.mgMeetingId);

  const { settings } = usePortalSettings();

  // Use motions hook without a specific agenda item - we'll pass targetAgendaItemId for each operation
  const { createMotion, updateMotion, deleteMotion } = useMotions(broadcast.mgMeetingId, null);

  // Helper function to send transcript markers
  const sendTranscriptMarker = useCallback(
    async (
      markerType: "agenda_clicked" | "agenda_completed" | "motion_added",
      label?: string,
      agendaItemId?: number,
      motionId?: number
    ) => {
      try {
        await fetch(getSophonHttpUrl("/transcribe/marker"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            streamKey: broadcast.streamKey,
            markerType,
            label,
            agendaItemId,
            motionId,
          }),
        });
      } catch (err) {
        console.warn("Failed to send transcript marker:", err);
      }
    },
    [broadcast.streamKey]
  );

  const handleStreamAvailabilityChange = useCallback((isAvailable: boolean) => {
    setIsStreamAvailable(isAvailable);
  }, []);

  const handleGoLive = useCallback(async () => {
    setIsActionLoading(true);
    try {
      await goLive(broadcast.id, broadcast.streamKey);
      toast.success("Broadcast is now live!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to go live");
    } finally {
      setIsActionLoading(false);
    }
  }, [broadcast.id, broadcast.streamKey, goLive]);

  const handlePause = useCallback(async () => {
    setIsActionLoading(true);
    try {
      await pauseBroadcast(broadcast.id, broadcast.streamKey);
      toast.info("Broadcast paused");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to pause");
    } finally {
      setIsActionLoading(false);
    }
  }, [broadcast.id, broadcast.streamKey, pauseBroadcast]);

  const handleEnd = useCallback(async () => {
    setShowEndConfirm(true);
  }, []);

  const handleCancelSetup = useCallback(async () => {
    if (!broadcast) {
      return;
    }

    setIsActionLoading(true);
    try {
      await deleteBroadcast(broadcast.id);
      toast.success("Setup canceled successfully");
      router.push("/a/broadcast");
    } catch (error) {
      console.error("Failed to cancel setup:", error);
      toast.error("Failed to cancel setup");
    } finally {
      setIsActionLoading(false);
    }
  }, [broadcast, deleteBroadcast, router]);

  const handleConfirmEnd = useCallback(async () => {
    setIsActionLoading(true);
    const meetingId = broadcast.mgMeetingId;
    try {
      await endBroadcast(broadcast.id, broadcast.streamKey);
      if (currentNotes?.trim().length) {
        toast.success("Notes will be exported to Documents");
      }
      toast.success("Broadcast ended");

      fetch(`/api/portal/meetings/${meetingId}/minutes/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      }).catch(() => {});

      setIsActionLoading(false);
      router.push(`/a/meetings/${meetingId}?autostart=true#minutes`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to end broadcast");
      setIsActionLoading(false);
    }
  }, [
    broadcast.id,
    broadcast.streamKey,
    broadcast.mgMeetingId,
    currentNotes,
    endBroadcast,
    router,
    orgId,
  ]);

  const handleSetCurrentAgendaItem = useCallback(
    async (itemId: number | null) => {
      if (!isOwner) {
        return;
      }
      try {
        let recordingPositionMs: number | undefined;
        if (itemId !== null && broadcast.startedAt) {
          const startTime = new Date(broadcast.startedAt).getTime();
          recordingPositionMs = Date.now() - startTime;
        }
        await setCurrentAgendaItem(broadcast.id, itemId, recordingPositionMs);

        if (itemId !== null && tree) {
          const agendaItem = findAgendaItemById(tree, itemId);
          if (agendaItem) {
            await sendTranscriptMarker("agenda_clicked", agendaItem.title, itemId);
          }
        }
      } catch {
        toast.error("Failed to update current agenda item");
      }
    },
    [broadcast.id, broadcast.startedAt, isOwner, setCurrentAgendaItem, tree, sendTranscriptMarker]
  );

  const handleToggleCompleted = useCallback(
    async (itemId: number, completed: boolean) => {
      if (!isOwner) {
        return;
      }
      if (completed) {
        try {
          let recordingPositionMs: number | undefined;
          if (broadcast.startedAt) {
            const startTime = new Date(broadcast.startedAt).getTime();
            recordingPositionMs = Date.now() - startTime;
          }
          await setCurrentAgendaItem(broadcast.id, itemId, recordingPositionMs);

          if (tree) {
            const agendaItem = findAgendaItemById(tree, itemId);
            if (agendaItem) {
              await sendTranscriptMarker("agenda_completed", agendaItem.title, itemId);
            }
          }

          await setCurrentAgendaItem(broadcast.id, null);
        } catch {
          toast.error("Failed to update agenda item");
        }
      }
    },
    [broadcast.id, broadcast.startedAt, isOwner, setCurrentAgendaItem, tree, sendTranscriptMarker]
  );

  const handleSaveNotes = useCallback(
    async (notes: string) => {
      if (!isOwner) {
        return;
      }
      try {
        await updateNotes(broadcast.id, notes);
        setCurrentNotes(notes);
      } catch {
        toast.error("Failed to save notes");
      }
    },
    [broadcast.id, isOwner, updateNotes]
  );

  // Motion handlers
  const handleCreateMotion = useCallback(
    async (agendaItemId: number, data: { title: string; mover: string; seconder: string }) => {
      if (!isOwner) {
        return;
      }
      try {
        const motion = await createMotion({
          title: data.title,
          mover: data.mover || undefined,
          seconder: data.seconder || undefined,
          agenda_item_id: agendaItemId,
        });
        await mutateAgenda();

        // Send motion marker
        await sendTranscriptMarker("motion_added", data.title, agendaItemId, motion.id);
      } catch {
        toast.error("Failed to create motion");
      }
    },
    [isOwner, createMotion, mutateAgenda, sendTranscriptMarker]
  );

  const handleUpdateMotion = useCallback(
    async (
      agendaItemId: number,
      motionId: number,
      data: { title: string; mover: string; seconder: string }
    ) => {
      if (!isOwner) {
        return;
      }
      try {
        await updateMotion(
          motionId,
          {
            title: data.title,
            mover: data.mover || undefined,
            seconder: data.seconder || undefined,
          },
          agendaItemId
        );
        await mutateAgenda();
      } catch {
        toast.error("Failed to update motion");
      }
    },
    [isOwner, updateMotion, mutateAgenda]
  );

  const handleDeleteMotion = useCallback(
    async (agendaItemId: number, motionId: number) => {
      if (!isOwner) {
        return;
      }
      try {
        await deleteMotion(motionId, agendaItemId);
        await mutateAgenda();
      } catch {
        toast.error("Failed to delete motion");
      }
    },
    [isOwner, deleteMotion, mutateAgenda]
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {broadcast.status === "live" && (
                <div className="flex items-center gap-2 px-3 py-1 bg-destructive/10 text-destructive rounded-full">
                  <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-sm font-medium">LIVE</span>
                </div>
              )}
              {broadcast.status === "paused" && (
                <div className="flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-full">
                  <LuRadio className="w-4 h-4" />
                  <span className="text-sm font-medium">PAUSED</span>
                </div>
              )}
              {broadcast.status === "setup" && (
                <div className="flex items-center gap-2 px-3 py-1 bg-muted text-muted-foreground rounded-full">
                  <LuRadio className="w-4 h-4" />
                  <span className="text-sm font-medium">SETUP</span>
                </div>
              )}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">{broadcast.meeting.title}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <LuCalendar className="w-4 h-4" />
                  {formatDate(broadcast.meeting.meetingDate)}
                </span>
                <span className="flex items-center gap-1">
                  <LuClock className="w-4 h-4" />
                  {formatTime(broadcast.meeting.meetingDate)}
                </span>
                {!isOwner && ownerName && (
                  <span className="flex items-center gap-1">
                    <LuUsers className="w-4 h-4" />
                    Managed by {ownerName}
                  </span>
                )}
              </div>
            </div>
          </div>
          {broadcast.status === "setup" && (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleCancelSetup} disabled={isActionLoading}>
                <LuX className="w-4 h-4 mr-2" />
                Cancel Setup
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-auto lg:overflow-hidden">
          <div className="lg:col-span-3 h-[50vh] lg:h-full overflow-hidden">
            <BroadcastAgendaPanel
              items={tree}
              currentAgendaItemId={broadcast.currentAgendaItemId}
              agendaTimestamps={broadcast.agendaTimestamps}
              onSetCurrentItem={handleSetCurrentAgendaItem}
              onToggleCompleted={handleToggleCompleted}
              onCreateMotion={handleCreateMotion}
              onUpdateMotion={handleUpdateMotion}
              onDeleteMotion={handleDeleteMotion}
              isOwner={isOwner}
            />
          </div>

          <div className="lg:col-span-6 flex flex-col gap-4 min-h-[60vh] lg:min-h-0 lg:h-full overflow-hidden">
            <div className="shrink-0">
              <BroadcastStreamView
                streamKey={broadcast.streamKey}
                status={broadcast.status}
                videoRef={videoRef}
                onStreamAvailabilityChange={handleStreamAvailabilityChange}
              />
            </div>
            <div className="flex-1 min-h-0 h-[40vh] lg:h-auto">
              <BroadcastTranscriptNotesPanel
                broadcastId={broadcast.id}
                streamKey={broadcast.streamKey}
                status={broadcast.status}
                notes={currentNotes}
                onSaveNotes={handleSaveNotes}
                videoRef={videoRef}
                orgId={orgId}
              />
            </div>
          </div>

          <div className="lg:col-span-3 flex flex-col gap-4 h-[50vh] lg:h-full overflow-hidden">
            {broadcast.status === "setup" && (
              <BroadcastSetupGuide streamKey={broadcast.streamKey} />
            )}
            <div className="shrink-0">
              <BroadcastQuickActions
                status={broadcast.status}
                streamKey={broadcast.streamKey}
                portalSlug={settings?.slug || null}
                isOwner={isOwner}
                onGoLive={handleGoLive}
                onPause={handlePause}
                onEnd={handleEnd}
                isLoading={isActionLoading}
                isStreamAvailable={isStreamAvailable}
              />
            </div>
            <div className="flex-1 min-h-0">
              <BroadcastDocumentsPanel meetingId={broadcast.mgMeetingId} orgId={orgId} />
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showEndConfirm}
        onOpenChange={setShowEndConfirm}
        title="End Broadcast"
        description="Are you sure you want to end this broadcast? This will stop the live stream and save the recording."
        confirmLabel="End Broadcast"
        confirmVariant="danger"
        onConfirm={handleConfirmEnd}
        isLoading={isActionLoading}
      />
    </div>
  );
}
