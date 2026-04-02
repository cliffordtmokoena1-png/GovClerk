import { useEffect, useRef } from "react";
import type { BroadcastTranscriptSegment } from "@/types/broadcast";

type Props = {
  segments: BroadcastTranscriptSegment[];
};

export function PublicLiveCaptions({ segments }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [segments.length]);

  if (segments.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400 text-sm">No live captions available yet</div>
    );
  }

  const sortedSegments = [...segments].sort((a, b) => a.segmentIndex - b.segmentIndex);

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
      {sortedSegments.map((segment) => (
        <div key={segment.id} className="flex gap-3">
          {segment.speakerLabel && (
            <span className="shrink-0 text-xs font-semibold text-blue-600 pt-0.5 min-w-[80px]">
              {segment.speakerLabel}
            </span>
          )}
          <p className="text-sm text-gray-800 leading-relaxed">{segment.text}</p>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
