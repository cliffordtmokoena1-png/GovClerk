import React, { useState, useCallback } from "react";
import { LuMic, LuStickyNote } from "react-icons/lu";
import { BroadcastTranscriptView } from "./BroadcastTranscriptView";
import { BroadcastNotesEditor } from "./BroadcastNotesEditor";
import type { BroadcastStatus } from "@/types/broadcast";

type TabId = "transcript" | "notes";

type Props = {
  broadcastId: number;
  streamKey: string;
  status: BroadcastStatus;
  notes: string | null;
  onSaveNotes: (notes: string) => Promise<void>;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  orgId: string;
};

export function BroadcastTranscriptNotesPanel({
  broadcastId,
  streamKey,
  status,
  notes,
  onSaveNotes,
  videoRef,
  orgId,
}: Readonly<Props>) {
  const [activeTab, setActiveTab] = useState<TabId>("transcript");

  const handleTabClick = useCallback((tab: TabId) => {
    setActiveTab(tab);
  }, []);

  const isNotesDisabled = false;

  return (
    <div className="h-full flex flex-col bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => handleTabClick("transcript")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "transcript"
              ? "text-primary border-b-2 border-primary bg-accent"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <LuMic className="w-4 h-4" />
          <span>Transcript</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabClick("notes")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "notes"
              ? "text-primary border-b-2 border-primary bg-accent"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <LuStickyNote className="w-4 h-4" />
          <span>Notes</span>
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "transcript" ? (
          <TranscriptTabContent
            broadcastId={broadcastId}
            streamKey={streamKey}
            status={status}
            videoRef={videoRef}
            orgId={orgId}
          />
        ) : (
          <NotesTabContent
            broadcastId={broadcastId}
            notes={notes}
            onSaveNotes={onSaveNotes}
            disabled={isNotesDisabled}
          />
        )}
      </div>
    </div>
  );
}

function TranscriptTabContent({
  broadcastId,
  streamKey,
  status,
  videoRef,
  orgId,
}: Readonly<{
  broadcastId: number;
  streamKey: string;
  status: BroadcastStatus;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  orgId: string;
}>) {
  const handleSeek = (seconds: number) => {
    if (videoRef?.current) {
      videoRef.current.currentTime = seconds;
    }
  };

  return (
    <BroadcastTranscriptView
      broadcastId={broadcastId}
      streamKey={streamKey}
      status={status}
      embedded
      onSeek={handleSeek}
      orgId={orgId}
    />
  );
}

function NotesTabContent({
  broadcastId,
  notes,
  onSaveNotes,
  disabled,
}: Readonly<{
  broadcastId: number;
  notes: string | null;
  onSaveNotes: (notes: string) => Promise<void>;
  disabled: boolean;
}>) {
  return (
    <BroadcastNotesEditor
      broadcastId={broadcastId}
      initialNotes={notes}
      onSave={onSaveNotes}
      disabled={disabled}
      embedded
    />
  );
}
