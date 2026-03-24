export interface Minute {
  text: string;
  isStreaming: boolean;
}

export type MinuteStatus =
  | "NOT_STARTED"
  | "STREAMING_INITIAL_MINUTE"
  | "INITIAL_MINUTE_COMPLETED"
  | "STREAMING_FEEDBACK"
  | "FEEDBACK_COMPLETED";

export interface MinutesState {
  minutes: Minute[];
  streamingMinuteText: string;
  status: MinuteStatus;
  dbStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
  isAnimating: boolean;
  isStreaming: boolean;
  isGeneratingFeedback: boolean;
  selectedTabIndex: number;
  getAllMinutes: (minutes: MinutesState) => Minute[];
  fastMode: boolean;
}

export const syncStatus = (minutes: MinutesState): MinuteStatus => {
  if (minutes.dbStatus === "NOT_STARTED") {
    return "NOT_STARTED";
  } else if (minutes.dbStatus === "IN_PROGRESS") {
    if (minutes.isGeneratingFeedback) {
      return "STREAMING_FEEDBACK";
    } else {
      return "STREAMING_INITIAL_MINUTE";
    }
  } else if (minutes.dbStatus === "COMPLETE") {
    if (minutes.isGeneratingFeedback || minutes.minutes.length > 1) {
      return "FEEDBACK_COMPLETED";
    } else {
      return "INITIAL_MINUTE_COMPLETED";
    }
  }
  return minutes.status;
};

export const getAllMinutes = (minutesState: MinutesState): Minute[] => {
  switch (minutesState.status) {
    case "NOT_STARTED":
      return [];
    case "STREAMING_INITIAL_MINUTE":
      return [{ text: minutesState.streamingMinuteText, isStreaming: true }];
    case "INITIAL_MINUTE_COMPLETED":
    case "FEEDBACK_COMPLETED":
      return minutesState.minutes;
    case "STREAMING_FEEDBACK":
      return [
        ...minutesState.minutes,
        { text: minutesState.streamingMinuteText, isStreaming: true },
      ];
  }
};

export const beginFeedbackStreaming = (prev: MinutesState): MinutesState => {
  const newSelected = prev.minutes.length;
  return {
    ...prev,
    isStreaming: true,
    isGeneratingFeedback: true,
    streamingMinuteText: "",
    status: "STREAMING_FEEDBACK",
    selectedTabIndex: newSelected,
    dbStatus: "IN_PROGRESS",
  };
};

export const stopStreaming = (prev: MinutesState): MinutesState => ({
  ...prev,
  isStreaming: false,
  isGeneratingFeedback: false,
  streamingMinuteText: "",
});

export const isRegenerationInProgress = (state: MinutesState): boolean => {
  return state.isStreaming || state.isGeneratingFeedback;
};

export const createMinutesState = (
  minutes: Minute[],
  status: MinuteStatus = "NOT_STARTED",
  fastMode: boolean = false
): MinutesState => ({
  minutes: minutes.map((minute) => ({ ...minute, isStreaming: false })),
  streamingMinuteText: "",
  status,
  isAnimating: false,
  selectedTabIndex: 0,
  isStreaming: false,
  isGeneratingFeedback: false,
  dbStatus: "NOT_STARTED",
  getAllMinutes,
  fastMode,
});
