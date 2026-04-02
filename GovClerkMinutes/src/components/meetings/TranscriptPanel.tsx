import React, { useRef, memo } from "react";
import { LuChevronDown } from "react-icons/lu";
import type { TranscriptApiData } from "@/types/types";
import type { Speaker } from "@/lib/speakerLabeler";
import { useTranscriptVirtualization } from "@/hooks/useTranscriptVirtualization";
import { colorFromString } from "@/utils/color";
import { formatTimestamp, timestampToSeconds } from "@/utils/time";

type TranscriptPanelProps = {
  transcript: TranscriptApiData;
  labelsToSpeaker: Record<string, Speaker>;
  currentAudioTime?: number;
  onSegmentClick?: (timestamp: number) => void;
  onSpeakerClick?: (label: string) => void;
  filteredSpeaker?: Speaker;
  className?: string;
  editable?: boolean;
  editedTexts?: Record<number, string>;
  onTextChange?: (segmentIndex: number, text: string) => void;
};

const TranscriptSegmentItem = memo(function TranscriptSegmentItem({
  segment,
  isActive,
  labelsToSpeaker,
  onSegmentClick,
  onSpeakerClick,
  isEditing,
  editedText,
  onTextChange,
}: {
  segment: TranscriptApiData["segments"][number];
  isActive: boolean;
  labelsToSpeaker: Record<string, Speaker>;
  onSegmentClick?: (timestamp: number) => void;
  onSpeakerClick?: (label: string) => void;
  isEditing?: boolean;
  editedText?: string;
  onTextChange?: (text: string) => void;
}) {
  const speakerLabel = segment.speaker;
  const speakerInfo = labelsToSpeaker[speakerLabel];
  const speakerColor =
    speakerInfo?.uses > 0 ? colorFromString(speakerInfo.name || speakerLabel) : "#94A3B8";
  const speakerName = speakerInfo?.name || speakerLabel;
  const speakerInitial = speakerName.charAt(0).toUpperCase();

  const handleTextareaRef = (el: HTMLTextAreaElement | null) => {
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  };

  if (segment.transcript === "" || segment.transcript === null) {
    return null;
  }

  return (
    <div
      className={`relative flex items-start gap-4 mb-6 transition-all duration-300 group ${
        isEditing ? "cursor-default" : "cursor-pointer"
      } ${isActive ? "opacity-100" : "opacity-80 hover:opacity-100"}`}
      onClick={() => !isEditing && onSegmentClick?.(timestampToSeconds(segment.start))}
    >
      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSpeakerClick?.(speakerLabel);
          }}
          className="flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-semibold shrink-0 hover:ring-2 hover:ring-offset-1 transition-shadow"
          style={{ backgroundColor: speakerColor }}
          title={speakerName}
        >
          {speakerInitial}
        </button>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSpeakerClick?.(speakerLabel);
            }}
            className="flex items-center gap-1 text-sm font-semibold text-foreground hover:underline"
          >
            {speakerName}
            <LuChevronDown className="w-3 h-3 opacity-60" />
          </button>
          <span className="text-xs text-gray-400">{formatTimestamp(segment.start)}</span>
        </div>
        {isEditing ? (
          <textarea
            ref={handleTextareaRef}
            value={editedText ?? segment.transcript}
            onChange={(e) => {
              onTextChange?.(e.target.value);
              // Auto-resize
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onClick={(e) => e.stopPropagation()}
            rows={1}
            className="w-full text-sm leading-relaxed text-foreground bg-muted/50 border border-primary/40 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
        ) : (
          <p className="text-sm leading-relaxed text-foreground text-justify">
            {editedText ?? segment.transcript}
          </p>
        )}
      </div>
    </div>
  );
});

export function TranscriptPanel({
  transcript,
  labelsToSpeaker,
  currentAudioTime = 0,
  onSegmentClick,
  onSpeakerClick,
  filteredSpeaker,
  className = "",
  editable = false,
  editedTexts = {},
  onTextChange,
}: TranscriptPanelProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const { filteredIndices, getSegmentData, findActiveSegmentIndex, virtualizer } =
    useTranscriptVirtualization({
      segments: transcript.segments,
      labelsToSpeaker,
      filteredSpeaker,
      parentRef,
    });

  const activeSegmentIdx = findActiveSegmentIndex(currentAudioTime);

  return (
    <div ref={parentRef} className={`flex-1 overflow-y-auto p-8 ${className}`}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const actualIndex = filteredIndices[virtualItem.index];
          const segment = getSegmentData(actualIndex);
          if (!segment) {
            return null;
          }

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <TranscriptSegmentItem
                segment={segment}
                isActive={activeSegmentIdx === virtualItem.index}
                labelsToSpeaker={labelsToSpeaker}
                onSegmentClick={onSegmentClick}
                onSpeakerClick={onSpeakerClick}
                isEditing={editable}
                editedText={editedTexts[actualIndex]}
                onTextChange={onTextChange ? (text) => onTextChange(actualIndex, text) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
