import { useMemo, useCallback } from "react";
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import type { TranscriptApiData } from "@/types/types";
import type { Speaker } from "@/lib/speakerLabeler";
import type { RefObject } from "react";
import { timestampToSeconds } from "@/utils/time";

const VIRTUALIZATION_DEFAULT_SEGMENT_HEIGHT = 80;
const VIRTUALIZATION_OVERSCAN_COUNT = 13;

export type UseTranscriptVirtualizationParams = {
  segments: TranscriptApiData["segments"];
  labelsToSpeaker: Record<string, Speaker>;
  filteredSpeaker?: Speaker;
  parentRef: RefObject<HTMLDivElement | null>;
};

export type UseTranscriptVirtualizationReturn = {
  filteredIndices: number[];
  getSegmentData: (index: number) => TranscriptApiData["segments"][number] | undefined;
  findActiveSegmentIndex: (currentTime: number) => number | null;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
};

export function useTranscriptVirtualization({
  segments,
  labelsToSpeaker,
  filteredSpeaker,
  parentRef,
}: UseTranscriptVirtualizationParams): UseTranscriptVirtualizationReturn {
  const stableLabelsToSpeaker = useMemo(() => {
    const map: Record<string, number | undefined> = {};
    Object.keys(labelsToSpeaker).forEach((speaker) => {
      const speakerData = labelsToSpeaker[speaker];
      if (speakerData) {
        map[speaker] = speakerData.id;
      }
    });
    return map;
  }, [labelsToSpeaker]);

  const filteredIndices = useMemo(() => {
    if (!filteredSpeaker) {
      return Array.from({ length: segments.length }, (_, i) => i);
    }

    const indices: number[] = [];
    const id = filteredSpeaker.id;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const speaker = segment.speaker || "";
      if (speaker && stableLabelsToSpeaker[speaker] === id) {
        indices.push(i);
      }
    }

    return indices;
  }, [segments, filteredSpeaker, stableLabelsToSpeaker]);

  const getSegmentData = useCallback((index: number) => segments[index], [segments]);

  const findActiveSegmentIndex = useCallback(
    (currentTime: number): number | null => {
      if (filteredIndices.length === 0) {
        return null;
      }

      let left = 0;
      let right = filteredIndices.length - 1;

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const actualIndex = filteredIndices[mid];
        const segment = segments[actualIndex];
        const start = timestampToSeconds(segment.start);
        const stop = timestampToSeconds(segment.stop);

        if (currentTime >= start && currentTime <= stop) {
          return mid;
        } else if (currentTime < start) {
          right = mid - 1;
        } else {
          left = mid + 1;
        }
      }

      return null;
    },
    [filteredIndices, segments]
  );

  const virtualizer = useVirtualizer<HTMLDivElement, Element>({
    count: filteredIndices.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => VIRTUALIZATION_DEFAULT_SEGMENT_HEIGHT,
    overscan: VIRTUALIZATION_OVERSCAN_COUNT,
    getItemKey: (index) => {
      const actualIndex = filteredIndices[index];
      return actualIndex ?? index;
    },
  });

  return {
    filteredIndices,
    getSegmentData,
    findActiveSegmentIndex,
    virtualizer,
  };
}
