import { useCallback, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { menuStateManager } from "@/utils/menuState";
import { Speaker, SpeakerLabelerOptions, applySpeakerLabel } from "@/lib/speakerLabeler";
import type { TranscriptApiData } from "@/types/types";

type Params = {
  labelsToSpeaker: { [key: string]: Speaker };
  triggerSpeakerLabel?: (speaker: Speaker, selectedLabel: string) => void;
  transcriptId?: number;
  sortedSpeakers: [string, Speaker][];
};

export type SpeakerLabelerHandler = (
  localUserInputName: string,
  selectedLabel: string,
  options?: SpeakerLabelerOptions
) => void;

export type SpeakerLabelerComponentBaseProps = {
  activeSegmentKey: string | null;
  segments: TranscriptApiData["segments"];
  labelsToSpeaker: Record<string, Speaker>;
  knownSpeakers: string[];
  triggerSpeakerLabel?: (speaker: Speaker, selectedLabel: string) => void;
  onOpenRelabelModal?: (
    currentSpeakerLabel: string,
    segmentStart: string,
    segmentStop: string
  ) => void;
  transcriptId?: number;
  onRequestClose: (segmentKey: string) => void;
};

export function useSpeakerLabeler({
  labelsToSpeaker,
  triggerSpeakerLabel,
  transcriptId,
  sortedSpeakers,
}: Params): SpeakerLabelerHandler {
  return useCallback(
    (localUserInputName, selectedLabel, options) => {
      applySpeakerLabel({
        labelsToSpeaker,
        selectedLabel,
        localUserInputName,
        triggerSpeakerLabel,
        transcriptId,
        sortedSpeakers,
        options,
      });
    },
    [labelsToSpeaker, triggerSpeakerLabel, transcriptId, sortedSpeakers]
  );
}

export type UseSpeakerLabelerMenuReturn = {
  segmentIndex: number | null;
  segment: TranscriptApiData["segments"][number] | undefined;
  sortedSpeakers: [string, Speaker][];
  onSpeakerLabeled: SpeakerLabelerHandler;
  userInputName: string;
  setUserInputName: Dispatch<SetStateAction<string>>;
  resetUserInputName: () => void;
  handleClose: () => void;
};

export function useSpeakerLabelerMenu({
  activeSegmentKey,
  segments,
  labelsToSpeaker,
  triggerSpeakerLabel,
  transcriptId,
  onRequestClose,
}: SpeakerLabelerComponentBaseProps): UseSpeakerLabelerMenuReturn {
  const segmentIndex = useMemo(
    () => (activeSegmentKey ? Number(activeSegmentKey) : null),
    [activeSegmentKey]
  );
  const segment = segmentIndex != null ? segments[segmentIndex] : undefined;

  const sortedSpeakers = useMemo(
    () => Object.entries(labelsToSpeaker).sort((a, b) => a[0].localeCompare(b[0])),
    [labelsToSpeaker]
  );

  const onSpeakerLabeled = useSpeakerLabeler({
    labelsToSpeaker,
    triggerSpeakerLabel,
    transcriptId,
    sortedSpeakers,
  });

  const [userInputName, setUserInputName] = useState("");

  const resetUserInputName = useCallback(() => {
    setUserInputName("");
  }, []);

  const handleClose = useCallback(() => {
    if (!activeSegmentKey) {
      return;
    }
    menuStateManager.setMenuState(activeSegmentKey, false);
    onRequestClose(activeSegmentKey);
  }, [activeSegmentKey, onRequestClose]);

  return {
    segmentIndex,
    segment,
    sortedSpeakers,
    onSpeakerLabeled,
    userInputName,
    setUserInputName,
    resetUserInputName,
    handleClose,
  };
}
