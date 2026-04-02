import { SIMILARITY_THRESHOLD } from "@/common/constants";
import { safeCapture } from "@/utils/safePosthog";

export type SpeakerIdentity = {
  id: number;
  name: string;
  similarityScore: number;
};

export type Speaker = {
  id: number;
  name: string;
  uses: number;
  suggestedSpeakers?: SpeakerIdentity[];
  tags?: string[];
};

export type SpeakerLabelerOptions = {
  resetUses?: boolean;
  clearSuggestions?: boolean;
  flagSuggestion?: boolean;
};

type SpeakerMap = { [key: string]: Speaker };

type SortedSpeakers = [string, Speaker][];

type SpeakerListItem = {
  name: string;
  similarity_score: number;
};

export function findIndexOfMatchingValue(list: SortedSpeakers, searchValue: string): number {
  return list.findIndex(([firstString]) => firstString === searchValue);
}

export function getDefaultSpeakerName(
  sortedSpeakers: SortedSpeakers,
  selectedLabel: string
): string {
  return `Speaker ${findIndexOfMatchingValue(sortedSpeakers, selectedLabel) + 1}`;
}

export function getValidSuggestion(
  labelsToSpeaker: SpeakerMap,
  selectedLabel: string
): SpeakerIdentity | undefined {
  const suggestions = labelsToSpeaker[selectedLabel]?.suggestedSpeakers || [];
  return suggestions.find((item) => item.similarityScore >= SIMILARITY_THRESHOLD);
}

export function buildSpeakerList(
  labelsToSpeaker: SpeakerMap,
  selectedLabel: string,
  knownSpeakers: string[]
): SpeakerListItem[] {
  const suggestions = labelsToSpeaker[selectedLabel]?.suggestedSpeakers || [];
  const speakerList = new Map<string, number>();

  knownSpeakers.forEach((name) => {
    speakerList.set(name, 0);
  });

  suggestions.forEach((suggestedSpeaker) => {
    if (
      suggestedSpeaker.name.match(/Speaker \d+/) ||
      suggestedSpeaker.similarityScore < SIMILARITY_THRESHOLD
    ) {
      return;
    }
    speakerList.set(suggestedSpeaker.name, suggestedSpeaker.similarityScore);
  });

  return Array.from(speakerList.entries())
    .map(([name, similarity_score]) => ({ name, similarity_score }))
    .sort((a, b) => b.similarity_score - a.similarity_score);
}

type ApplySpeakerLabelParams = {
  labelsToSpeaker: SpeakerMap;
  selectedLabel: string;
  localUserInputName: string;
  triggerSpeakerLabel?: (speaker: Speaker, selectedLabel: string) => void;
  transcriptId?: number;
  sortedSpeakers: SortedSpeakers;
  options?: SpeakerLabelerOptions;
};

export function applySpeakerLabel({
  labelsToSpeaker,
  selectedLabel,
  localUserInputName,
  triggerSpeakerLabel,
  transcriptId,
  sortedSpeakers,
  options,
}: ApplySpeakerLabelParams) {
  const speakerData = labelsToSpeaker[selectedLabel];
  if (!speakerData) {
    return;
  }

  const suggestedSpeakers = speakerData.suggestedSpeakers || [];
  const validSuggestion = suggestedSpeakers.find(
    (item) => item.similarityScore >= SIMILARITY_THRESHOLD
  );
  const topSuggestion = validSuggestion?.name;
  const defaultSpeakerName = getDefaultSpeakerName(sortedSpeakers, selectedLabel);

  const isOverride =
    !options?.resetUses &&
    localUserInputName !== defaultSpeakerName &&
    topSuggestion &&
    localUserInputName !== topSuggestion;

  if (isOverride) {
    safeCapture("speaker_suggestion_override", {
      transcript_id: transcriptId,
      original_label: selectedLabel,
      new_name: localUserInputName,
      had_valid_suggestions: Boolean(validSuggestion),
      top_suggestion: topSuggestion || null,
      top_suggestion_score: validSuggestion?.similarityScore,
      default_name: defaultSpeakerName,
    });
  }

  if (options?.flagSuggestion && validSuggestion && transcriptId) {
    safeCapture("speaker_suggestion_bad_explicit", {
      transcript_id: transcriptId,
      speaker_label: selectedLabel,
      suggested_name: validSuggestion.name,
      suggestion_score: validSuggestion.similarityScore,
    });
  }

  const updatedSpeaker: Speaker = {
    ...speakerData,
    name: localUserInputName,
    uses: options?.resetUses ? 0 : speakerData.uses + 1,
    suggestedSpeakers: options?.clearSuggestions ? [] : speakerData.suggestedSpeakers,
  };

  if (triggerSpeakerLabel) {
    triggerSpeakerLabel(updatedSpeaker, selectedLabel);
  } else {
    console.warn(
      "[applySpeakerLabel] triggerSpeakerLabel is not defined — label update was not persisted."
    );
  }
}

export type SpeakerListItemType = SpeakerListItem;
