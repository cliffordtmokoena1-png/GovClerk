import React, { useState } from "react";
import { useRouter } from "next/router";
import { HiSignal } from "react-icons/hi2";
import { useBroadcast } from "@/hooks/broadcast/useBroadcast";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./ConfirmDialog";

type Props = {
  meetingId: number;
  meetingTitle: string;
  variant?: "icon" | "button";
  className?: string;
};

function getIconClassName(isActive: boolean, isOtherActive: boolean): string {
  if (isActive) {
    return "text-destructive hover:text-destructive/90 hover:bg-destructive/10";
  }
  if (isOtherActive) {
    return "text-muted cursor-not-allowed";
  }
  return "text-muted-foreground hover:text-primary hover:bg-accent";
}

function getTooltip(isActive: boolean, isOtherActive: boolean, meetingTitle: string): string {
  if (isActive) {
    return "Go to active broadcast";
  }
  if (isOtherActive) {
    return "Another broadcast is active";
  }
  return `Start broadcast for ${meetingTitle}`;
}

export function StartBroadcastButton({
  meetingId,
  meetingTitle,
  variant = "button",
  className = "",
}: Readonly<Props>) {
  const router = useRouter();
  const { broadcast, isLoading, startBroadcast, checkExistingSegments } = useBroadcast();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [segmentCount, setSegmentCount] = useState(0);

  const handleStartBroadcast = async () => {
    setIsStarting(true);
    try {
      await startBroadcast(meetingId);
      router.push("/a/broadcast");
    } catch (error) {
      console.error("Failed to start broadcast:", error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleClick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();

    if (broadcast) {
      router.push("/a/broadcast");
      return;
    }

    setIsStarting(true);
    try {
      const { hasExistingSegments, segmentCount: count } = await checkExistingSegments(meetingId);

      if (hasExistingSegments) {
        setSegmentCount(count);
        setShowConfirmDialog(true);
        setIsStarting(false);
        return;
      }

      await handleStartBroadcast();
    } catch (error) {
      console.error("[StartBroadcastButton] Failed to check segments:", error);
      setIsStarting(false);
    }
  };

  const handleConfirmStart = async () => {
    setShowConfirmDialog(false);
    await handleStartBroadcast();
  };

  if (isLoading) {
    return null;
  }

  const isOtherBroadcastActive = Boolean(broadcast && broadcast.mgMeetingId !== meetingId);
  const isThisBroadcastActive = broadcast?.mgMeetingId === meetingId;

  const tooltip = getTooltip(isThisBroadcastActive, isOtherBroadcastActive, meetingTitle);

  const confirmDescription = (
    <>
      This meeting has <strong>{segmentCount}</strong> existing transcript segment
      {segmentCount !== 1 ? "s" : ""} from a previous broadcast. Starting a new broadcast will{" "}
      <strong>permanently delete</strong> all previous transcript data.
    </>
  );

  if (variant === "icon") {
    const iconClass = getIconClassName(isThisBroadcastActive, isOtherBroadcastActive);
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          disabled={isOtherBroadcastActive || isStarting}
          className={`p-2 rounded-lg transition-colors ${iconClass} ${className}`}
          title={tooltip}
          aria-label={tooltip}
        >
          <HiSignal className={`w-4 h-4 ${isThisBroadcastActive ? "animate-pulse" : ""}`} />
        </button>
        <ConfirmDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
          title="Start New Broadcast?"
          description={confirmDescription}
          confirmLabel="Start Broadcast"
          cancelLabel="Cancel"
          confirmVariant="danger"
          onConfirm={handleConfirmStart}
          isLoading={isStarting}
        />
      </>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant={isThisBroadcastActive ? "destructive" : "default"}
        onClick={handleClick}
        disabled={isOtherBroadcastActive || isStarting}
        className={`flex items-center gap-2 ${className}`}
        title={tooltip}
      >
        <HiSignal className={`w-4 h-4 ${isThisBroadcastActive ? "animate-pulse" : ""}`} />
        {isThisBroadcastActive ? "Live" : isStarting ? "Starting..." : "Start Broadcast"}
      </Button>
      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Start New Broadcast?"
        description={confirmDescription}
        confirmLabel="Start Broadcast"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={handleConfirmStart}
        isLoading={isStarting}
      />
    </>
  );
}
