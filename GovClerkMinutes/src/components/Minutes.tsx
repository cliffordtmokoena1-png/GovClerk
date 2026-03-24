import { Flex, Tabs, TabList, Tab, TabPanel, TabPanels, Box, useToast } from "@chakra-ui/react";
import { ApiLabelSpeakerResponseResult1 } from "@/pages/api/label-speaker";
import { useEffect, useState, useRef, useCallback } from "react";
import { LayoutKind } from "@/pages/dashboard/[[...slug]]";
import { safeCapture } from "@/utils/safePosthog";
import MarkdownMinutes from "./MarkdownMinutes";
import {
  Minute,
  MinutesState,
  MinuteStatus,
  createMinutesState,
  syncStatus,
} from "@/types/MinutesState";
import MinutesProgressStepper from "./MinutesProgressStepper";
import { UploadKind } from "@/uploadKind/uploadKind";
import { Speaker } from "@/lib/speakerLabeler";

export type ApiGetMinutesResponseResult = {
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
  minutes?: string[];
  rating?: string;
  selectedTabIndex?: number;
  steps?: { name: string; status: string }[];
};

type Props = {
  transcriptId: number;
  minutesData?: ApiGetMinutesResponseResult;
  showSpeakerLabeler?: boolean;
  showInstructions: boolean;
  speakerData?: ApiLabelSpeakerResponseResult1;
  uploadKind: UploadKind;
  paywallIsShowing: boolean;
  layoutKind: LayoutKind;
  isPreviewTranscriptDone: boolean;
  transcriptionPaused?: boolean;
  insufficientToken?: boolean;
  hideVersionTabs?: boolean; // Hide version tabs for mobile tabbed view
  bottomSpacing?: number; // Custom bottom spacing for mobile tabbed view
  externalSelectedVersion?: number; // External control of selected version for mobile
  onVersionChange?: (version: number) => void;
  onRegenerationStateChange?: (isRegenerating: boolean) => void;
  triggerSpeakerLabel?: (speaker: Speaker, selectedLabel: string) => void;
};

const Minutes = ({
  transcriptId,
  minutesData,
  speakerData,
  uploadKind,
  transcriptionPaused = false,
  insufficientToken = false,
  hideVersionTabs = false,
  externalSelectedVersion,
  onVersionChange,
  onRegenerationStateChange,
  triggerSpeakerLabel,
}: Props) => {
  const toast = useToast();

  const [minutesManager, setMinutesManager] = useState<MinutesState>(
    createMinutesState(
      minutesData?.minutes
        ? (minutesData.minutes.map((item) => ({ text: item, isStreaming: false })) as Minute[])
        : [],
      "NOT_STARTED",
      false
    )
  );
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const markdownRef = useRef<HTMLDivElement | null>(null);

  const isPreviewTranscriptEmpty = speakerData?.isPreviewTranscriptEmpty;

  const transformMentionsToLabels = (text: string) => {
    let result = text;

    // Use a regex pattern similar to the one in reverseTransformSpeakerLabels
    // This matches spans with data-label attribute
    const mentionRegex = /<span[^>]*data-label="([^"]+)"[^>]*>.*?<\/span>/g;

    result = result.replace(mentionRegex, (_, label) => {
      return `{{${label}}}`;
    });

    return result;
  };

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const saveMinutes = useCallback(
    async (content: string, version: number) => {
      try {
        setIsSaving(true);
        const withLabels = transformMentionsToLabels(content);
        const response = await fetch("/api/save-minutes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transcriptId,
            content: withLabels,
            version,
            fastMode: false,
          }),
        });

        safeCapture("minutes_saved", {
          transcriptId,
          xversion: version,
        });

        if (!response.ok) {
          throw new Error("Failed to save minutes");
        }
        setLastSaved(new Date());
      } catch (error) {
        console.error("Error saving minutes:", error);
        toast({
          title: "Failed to save minutes",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setIsSaving(false);
      }
    },
    [transcriptId, toast]
  );

  const handleSaveMinutes = useCallback(
    (content: string, version: number) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      setIsSaving(true);
      saveTimeoutRef.current = setTimeout(() => {
        saveMinutes(content, version);
      }, 3000);
    },
    [saveMinutes]
  );

  const firstLoadRef = useRef(true);
  const prevTranscriptIdRef = useRef(transcriptId);

  useEffect(() => {
    if (prevTranscriptIdRef.current !== transcriptId) {
      firstLoadRef.current = true;
      prevTranscriptIdRef.current = transcriptId;
    }
  }, [transcriptId]);

  useEffect(() => {
    if (!minutesData) {
      return;
    }

    // No longer using preview minutes as fast preview has been removed
    const regularMinutes = minutesData?.minutes || [];

    setMinutesManager((prev) => {
      let newTabIndex = prev.selectedTabIndex;

      const totalTabs = regularMinutes.length;
      const maxValidTabIndex = totalTabs > 0 ? totalTabs - 1 : 0;

      const previousTabValid =
        prev.selectedTabIndex !== undefined &&
        prev.selectedTabIndex <= maxValidTabIndex &&
        prev.selectedTabIndex >= 0;

      // Only select the latest tab on first load or if current selection is invalid
      if (firstLoadRef.current || !previousTabValid) {
        if (regularMinutes.length > 0) {
          // Select the latest version tab (last regular minute)
          newTabIndex = regularMinutes.length - 1;
        } else {
          newTabIndex = 0;
        }
        // Mark that first load is complete
        firstLoadRef.current = false;
      }

      if (prev.status === "STREAMING_INITIAL_MINUTE") {
        newTabIndex = 0;
      }

      const isComplete = minutesData.status === "COMPLETE";
      const isInProgress = minutesData.status === "IN_PROGRESS";

      // If we're in progress and not already streaming, restore streaming state
      const shouldRestoreStreaming = isInProgress && !prev.isStreaming && regularMinutes.length > 0;

      // Calculate the new tab index for streaming state
      let streamingTabIndex = newTabIndex;
      if (shouldRestoreStreaming) {
        // Switch to the tab that would be created for the pending minute
        streamingTabIndex = regularMinutes.length;
      }

      const isStreamingState = isComplete ? false : shouldRestoreStreaming || prev.isStreaming;
      const isGeneratingFeedbackState = isComplete
        ? false
        : shouldRestoreStreaming || prev.isGeneratingFeedback;

      let newStatus: MinuteStatus;
      if (isComplete) {
        newStatus = "INITIAL_MINUTE_COMPLETED";
      } else if (
        !minutesData?.steps ||
        !minutesData.steps.every((step) => step.status === "Success")
      ) {
        newStatus = "NOT_STARTED";
      } else if (regularMinutes.length > 0) {
        newStatus = "INITIAL_MINUTE_COMPLETED";
      } else {
        newStatus = "NOT_STARTED";
      }

      const newMinutes: MinutesState = {
        ...prev,
        dbStatus: minutesData.status,
        minutes: regularMinutes.map((item) => ({ text: item, isStreaming: false })),
        selectedTabIndex: shouldRestoreStreaming ? streamingTabIndex : newTabIndex,
        streamingMinuteText: shouldRestoreStreaming ? "" : prev.streamingMinuteText,
        isAnimating: isComplete ? false : prev.isAnimating,
        isStreaming: isStreamingState,
        isGeneratingFeedback: isGeneratingFeedbackState,
        getAllMinutes: prev.getAllMinutes,
        status: newStatus,
      };

      newMinutes.status = syncStatus(newMinutes);
      return newMinutes;
    });
  }, [minutesData]);

  useEffect(() => {
    if (
      minutesData &&
      typeof minutesData === "object" &&
      "selectedTabIndex" in minutesData &&
      minutesData.selectedTabIndex !== minutesManager.selectedTabIndex
    ) {
      minutesData.selectedTabIndex = minutesManager.selectedTabIndex;
    }
  }, [minutesData, minutesManager.selectedTabIndex]);

  // Sync external version control via a simple one-way sync
  useEffect(() => {
    if (
      externalSelectedVersion !== undefined &&
      externalSelectedVersion !== minutesManager.selectedTabIndex
    ) {
      setMinutesManager((prev) => ({
        ...prev,
        selectedTabIndex: externalSelectedVersion,
      }));
    }
  }, [externalSelectedVersion, minutesManager.selectedTabIndex]);

  // Notify parent of regeneration state changes
  const prevRegeneratingRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (onRegenerationStateChange) {
      const isRegenerating = minutesManager.status === "STREAMING_FEEDBACK";
      if (prevRegeneratingRef.current !== isRegenerating) {
        prevRegeneratingRef.current = isRegenerating;
        onRegenerationStateChange(isRegenerating);
      }
    }
  }, [minutesManager.status, onRegenerationStateChange]);

  const tabContentCache = useRef<Record<number, string>>({});

  const handleMinutesChange = useCallback((content: string) => {
    setMinutesManager((prev) => {
      const selectedIndex = prev.selectedTabIndex;

      const minutesIndex = selectedIndex;

      const cacheKey = minutesIndex;
      if (tabContentCache.current[cacheKey] === content) {
        return prev;
      }

      tabContentCache.current[cacheKey] = content;

      const newMinutes = [...prev.minutes];

      if (minutesIndex >= 0 && minutesIndex < newMinutes.length) {
        newMinutes[minutesIndex] = { text: content, isStreaming: false };
      } else if (newMinutes.length === 0) {
        newMinutes.push({ text: content, isStreaming: false });
      }

      return {
        ...prev,
        minutes: newMinutes,
      };
    });
  }, []);

  if (minutesData == null || (speakerData == null && uploadKind === "audio")) {
    return null;
  }

  const { status, steps } = minutesData;
  const allStepsCompleted = !steps || steps.every((step) => step.status === "Success");

  return (
    <Flex
      flexDirection="column"
      alignItems="center"
      justifyContent={status !== "COMPLETE" ? "center" : "start"}
      h="full"
      w="full"
      bgColor="white"
      overflowY="scroll"
    >
      <Flex
        w="full"
        overflowY="auto"
        bg="white"
        flexDirection="column"
        justifyContent={minutesManager.status === "NOT_STARTED" ? "center" : "flex-start"}
        height="full"
        p={{ base: 0, md: 0 }}
        ref={markdownRef}
      >
        {(() => {
          // Show paused indicator regardless of other conditions when transcription is paused
          if (transcriptionPaused || insufficientToken) {
            return (
              <Flex
                direction="column"
                align="center"
                justify="center"
                p={6}
                position="relative"
                flex="1"
                h="full"
                w="full"
              >
                <Box
                  position="absolute"
                  top="50%"
                  left="50%"
                  transform="translate(-50%, -50%)"
                  width="100%"
                  maxW="lg"
                  px={{ base: 4, md: 0 }}
                >
                  <MinutesProgressStepper
                    steps={minutesData?.steps}
                    isPaused
                    pauseReason={insufficientToken ? "insufficient_tokens" : "paused"}
                  />
                </Box>
              </Flex>
            );
          }

          if (
            (minutesManager.status === "NOT_STARTED" || !allStepsCompleted) &&
            !isPreviewTranscriptEmpty // If empty, we need to show the Get your minutes button instead.
          ) {
            return (
              <Flex
                direction="column"
                align="center"
                justify="center"
                p={6}
                position="relative"
                flex="1"
                h="full"
                w="full"
              >
                <Box
                  position="absolute"
                  top="50%"
                  left="50%"
                  transform="translate(-50%, -50%)"
                  width="100%"
                  maxW="lg"
                  px={{ base: 4, md: 0 }}
                >
                  <MinutesProgressStepper
                    steps={minutesData?.steps}
                    isPaused={transcriptionPaused || insufficientToken}
                    pauseReason={insufficientToken ? "insufficient_tokens" : "paused"}
                  />
                </Box>
              </Flex>
            );
          } else {
            return (
              <Flex flexDir="column" w="full" h="full">
                <Box
                  top={0}
                  zIndex={3}
                  bgColor="white"
                  borderBottomColor="gray.200"
                  flex={1}
                  h="full"
                >
                  <Tabs
                    variant="enclosed"
                    h="full"
                    size="md"
                    display="flex"
                    flexDirection="column"
                    index={minutesManager.selectedTabIndex}
                    onChange={(index) => {
                      setMinutesManager((prev) => ({
                        ...prev,
                        selectedTabIndex: index,
                      }));
                      // Notify parent of version change (for mobile)
                      if (onVersionChange) {
                        onVersionChange(index);
                      }
                    }}
                  >
                    {!hideVersionTabs && (
                      <Box
                        position="sticky"
                        top={0}
                        zIndex={200}
                        bgColor="white"
                        borderBottomColor="gray.200"
                        borderBottom="1px solid"
                      >
                        <TabList borderBottomColor="gray.200">
                          {(minutesManager.minutes.length > 0 ||
                            minutesManager.status === "STREAMING_INITIAL_MINUTE") && (
                            <Tab isDisabled={minutesManager.isAnimating}>Version 1</Tab>
                          )}
                          {minutesManager.minutes.slice(1).map((_, index) => (
                            <Tab key={index} isDisabled={minutesManager.isAnimating}>
                              Version {index + 2}
                            </Tab>
                          ))}
                          {minutesManager.status === "STREAMING_FEEDBACK" && (
                            <Tab isDisabled={minutesManager.isAnimating}>
                              Version {minutesManager.minutes.length + 1}
                            </Tab>
                          )}
                        </TabList>
                      </Box>
                    )}
                    <Box
                      border={hideVersionTabs ? "none" : "1px solid"}
                      borderColor="gray.200"
                      borderTop="none"
                      flex="1"
                      minH="0"
                      overflowY="auto"
                      className={hideVersionTabs ? "mobile-minutes-view" : ""}
                      pb={hideVersionTabs ? "144px" : "0"}
                    >
                      <TabPanels h="full">
                        {(minutesManager.minutes.length > 0 ||
                          minutesManager.status === "STREAMING_INITIAL_MINUTE") && (
                          <TabPanel padding={0}>
                            <MarkdownMinutes
                              minutes={
                                minutesManager.status === "STREAMING_INITIAL_MINUTE"
                                  ? minutesManager.streamingMinuteText
                                  : minutesManager.minutes[0]?.text || ""
                              }
                              onSave={(content) => handleSaveMinutes(content, 1)}
                              transcriptId={transcriptId}
                              setMinutesManager={setMinutesManager}
                              isPreview={false}
                              isUpdating={minutesManager.isAnimating || minutesManager.isStreaming}
                              version={1}
                              isLatest={minutesManager.minutes.length === 1}
                              canRegenerate={
                                minutesManager.getAllMinutes(minutesManager).length < 3
                              }
                              lastSaved={lastSaved}
                              isSaving={isSaving}
                              speakerData={speakerData}
                              onMinutesChange={handleMinutesChange}
                              inMobileTabbedView={hideVersionTabs}
                              onSpeakerUpdate={triggerSpeakerLabel}
                            />
                          </TabPanel>
                        )}
                        {minutesManager.minutes.slice(1).map((minute, index) => (
                          <TabPanel key={index} padding={0}>
                            <MarkdownMinutes
                              minutes={minute.text}
                              onSave={(content) => handleSaveMinutes(content, index + 2)}
                              transcriptId={transcriptId}
                              setMinutesManager={setMinutesManager}
                              isPreview={false}
                              isUpdating={minutesManager.isAnimating || minutesManager.isStreaming}
                              version={index + 2}
                              isLatest={index === minutesManager.minutes.length - 2}
                              canRegenerate={
                                minutesManager.getAllMinutes(minutesManager).length < 3
                              }
                              lastSaved={lastSaved}
                              isSaving={isSaving}
                              speakerData={speakerData}
                              onMinutesChange={handleMinutesChange}
                              inMobileTabbedView={hideVersionTabs}
                              onSpeakerUpdate={triggerSpeakerLabel}
                            />
                          </TabPanel>
                        ))}
                        {minutesManager.status === "STREAMING_FEEDBACK" && (
                          <TabPanel padding={0}>
                            <MarkdownMinutes
                              minutes={minutesManager.streamingMinuteText}
                              onSave={(content) =>
                                handleSaveMinutes(content, minutesManager.minutes.length + 1)
                              }
                              transcriptId={transcriptId}
                              setMinutesManager={setMinutesManager}
                              isPreview={false}
                              isUpdating={minutesManager.isAnimating || minutesManager.isStreaming}
                              version={minutesManager.minutes.length}
                              isLatest
                              canRegenerate={
                                minutesManager.getAllMinutes(minutesManager).length < 3
                              }
                              lastSaved={lastSaved}
                              isSaving={isSaving}
                              speakerData={speakerData}
                              onMinutesChange={handleMinutesChange}
                              inMobileTabbedView={hideVersionTabs}
                              onSpeakerUpdate={triggerSpeakerLabel}
                            />
                          </TabPanel>
                        )}
                      </TabPanels>
                    </Box>
                  </Tabs>
                </Box>
                {hideVersionTabs && (
                  <style jsx global>{`
                    .mobile-minutes-view .tiptap-editor .ProseMirror {
                      padding: 0.75rem 0 !important;
                    }
                  `}</style>
                )}
              </Flex>
            );
          }
        })()}
      </Flex>
    </Flex>
  );
};

export default Minutes;
