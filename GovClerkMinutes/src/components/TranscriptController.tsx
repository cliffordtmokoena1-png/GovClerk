import { useState, useCallback, useMemo, useEffect } from "react";
import { Flex, VStack, Button, ButtonGroup } from "@chakra-ui/react";
import SpeakerLabeler from "./SpeakerLabeler";
import { Speaker } from "@/lib/speakerLabeler";
import Transcript from "./Transcript";
import { ApiTranscriptStatusResponseResult } from "@/pages/api/transcript-status";
import AudioPlayer from "./AudioPlayer";
import Minutes, { ApiGetMinutesResponseResult } from "./Minutes";
import H5AudioPlayer from "react-h5-audio-player";
import { LayoutKind } from "@/pages/dashboard/[[...slug]]";
import ProductTopBar from "./ProductTopBar";
import RelabelSegmentModal from "./RelabelSegmentModal";
import RenameTranscriptModal from "./RenameTranscriptModal";
import MobileTranscriptMinutesView from "./mobile/MobileTranscriptMinutesView";
import MobileSpeakersList from "./mobile/MobileSpeakersList";
import { MobileSpeakerLabelerDrawer } from "./MobileSpeakerLabelerDrawer";
import MobileExportDrawer from "./mobile/MobileExportDrawer";
import MobileTranscriptActionsDrawer from "./mobile/MobileTranscriptActionsDrawer";
import { useExportHandlers } from "@/hooks/useExportHandlers";
import { revalidateTranscriptStatus } from "@/revalidations/revalidateTranscriptStatus";
import saveAs from "file-saver";

import { ApiLabelSpeakerResponseResult1 } from "@/pages/api/label-speaker";

type Props = {
  transcriptId: number;
  transcribeFinished: boolean;
  showSpeakerLabeler?: boolean;
  audioSrc?: string;
  setDuration: (duration: number) => void;
  diarizationReady?: boolean;
  getMinutesData?: ApiGetMinutesResponseResult;
  audioPlayerRef: React.RefObject<H5AudioPlayer | null>;
  paywallIsShowing: boolean;
  layoutKind: LayoutKind;
  showProgress: boolean;
  uploadComplete: boolean;
  transcriptionStatus?: ApiTranscriptStatusResponseResult;
  transcriptData?: ApiLabelSpeakerResponseResult1;
  triggerSpeakerLabel: (speaker: Speaker, selectedLabel: string) => void;
  handleSegmentRelabel: (
    segmentStart: string,
    segmentStop: string,
    newSpeakerLabel: string
  ) => void;
};

const TranscriptController = ({
  transcriptId,
  transcribeFinished,
  showSpeakerLabeler,
  audioSrc,
  setDuration,
  diarizationReady,
  getMinutesData,
  audioPlayerRef,
  uploadComplete,
  paywallIsShowing,
  layoutKind,
  showProgress,
  transcriptionStatus,
  transcriptData,
  triggerSpeakerLabel,
  handleSegmentRelabel,
}: Props) => {
  const [selectedLabel, setSelectedLabel] = useState<string>("A");
  const [filteredSpeaker, setFilteredSpeaker] = useState<Speaker>();
  const isMobileLayout = layoutKind !== "desktop";
  const minutesTabCount = useMemo(() => {
    if (!getMinutesData) {
      return 1;
    }
    const baseCount = getMinutesData.minutes?.length || 0;

    const streamingTab = getMinutesData.status === "IN_PROGRESS" ? 1 : 0;
    return Math.max(1, baseCount + streamingTab);
  }, [getMinutesData]);

  const [selectedMinutesVersion, setSelectedMinutesVersion] = useState<number>(
    getMinutesData?.selectedTabIndex || 0
  );
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    if (getMinutesData?.selectedTabIndex !== undefined) {
      setSelectedMinutesVersion(getMinutesData.selectedTabIndex);
    }
  }, [getMinutesData?.selectedTabIndex]);

  const [relabelModalState, setRelabelModalState] = useState<{
    isOpen: boolean;
    currentSpeakerLabel: string;
    segmentStart: string;
    segmentStop: string;
  } | null>(null);

  const [activeSpeakerLabel, setActiveSpeakerLabel] = useState<string | null>(null);

  const [isExportDrawerOpen, setIsExportDrawerOpen] = useState(false);
  const [isActionsDrawerOpen, setIsActionsDrawerOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);

  const handleOpenRelabelModal = useCallback(
    (currentSpeakerLabel: string, segmentStart: string, segmentStop: string) => {
      setRelabelModalState({
        isOpen: true,
        currentSpeakerLabel,
        segmentStart,
        segmentStop,
      });
    },
    []
  );

  const handleCloseRelabelModal = useCallback(() => {
    setRelabelModalState(null);
  }, []);

  const handleRelabelSuccess = useCallback(
    (newSpeakerLabel: string, segmentStart: string, segmentStop: string) => {
      handleSegmentRelabel(segmentStart, segmentStop, newSpeakerLabel);
      handleCloseRelabelModal();
    },
    [handleSegmentRelabel, handleCloseRelabelModal]
  );

  const handleMinutesVersionChange = useCallback(
    (version: number) => {
      setSelectedMinutesVersion(version);
      if (getMinutesData) {
        getMinutesData.selectedTabIndex = version;
      }
    },
    [getMinutesData]
  );

  const handleRegenerationStateChange = useCallback((regenerating: boolean) => {
    setIsRegenerating(regenerating);
  }, []);

  const getMinutesContent = useCallback(() => {
    if (!getMinutesData) {
      return "";
    }

    let minutesContent = "";
    const currentTabIndex = selectedMinutesVersion;

    if (getMinutesData.minutes?.length) {
      const versionIndex =
        currentTabIndex >= 0 && currentTabIndex < getMinutesData.minutes.length
          ? currentTabIndex
          : getMinutesData.minutes.length - 1;

      minutesContent = getMinutesData.minutes[versionIndex] || "";
    }

    if (transcriptData?.labelsToSpeaker && minutesContent) {
      const labels = Object.keys(transcriptData.labelsToSpeaker);
      labels.forEach((label) => {
        const placeholder = `{{${label}}}`;
        const speakerName = transcriptData.labelsToSpeaker?.[label]?.name;
        if (speakerName) {
          minutesContent = minutesContent.split(placeholder).join(speakerName);
        }
      });
    }

    return minutesContent;
  }, [getMinutesData, selectedMinutesVersion, transcriptData?.labelsToSpeaker]);

  const { handleCopyMinutes, handleCopyTranscript, handleExportMinutes, handleExportTranscript } =
    useExportHandlers({
      transcriptId,
      title: transcriptionStatus?.title,
      transcript: transcriptData?.transcript,
      labelsToSpeaker: transcriptData?.labelsToSpeaker,
      getMinutesContent,
      minutesData: getMinutesData,
      selectedVersion: selectedMinutesVersion,
    });

  const [viewMode, setViewMode] = useState<"both" | "minutes" | "transcript">("both");

  const handleRename = useCallback(() => {
    setIsRenameModalOpen(true);
  }, []);

  const handleRenameSuccess = useCallback(async () => {
    await revalidateTranscriptStatus(transcriptId);
    setIsRenameModalOpen(false);
  }, [transcriptId]);

  if (transcriptData == null || transcriptData.labelsToSpeaker == null) {
    return (
      <Flex flexDir="column" h="full" w="full">
        <ProductTopBar
          transcriptId={transcriptId}
          transcribeFinished={transcribeFinished}
          showProgress
          getMinutesData={getMinutesData}
        />
        <Flex minH="72px" h="72px" w="full" bg="white"></Flex>
        <Flex bg="gray.50" h="full" w="full" borderRadius="md"></Flex>
      </Flex>
    );
  }

  const { isPreviewTranscriptDone } = transcriptData || {};

  if (isMobileLayout) {
    return (
      <Flex flexDir="column" w="full" h="full">
        <MobileTranscriptMinutesView
          transcriptId={transcriptId}
          transcriptTitle={transcriptionStatus?.title || "Transcript"}
          audioSrc={audioSrc}
          audioPlayerRef={audioPlayerRef}
          uploadComplete={uploadComplete}
          transcribeFinished={transcribeFinished}
          minutesReady={getMinutesData?.status === "COMPLETE"}
          onDuration={(duration) => {
            if (duration != null) {
              setDuration(duration);
            }
          }}
          onAudioLoadError={(error) => {
            console.error(error);
          }}
          transcriptContent={
            <Transcript
              transcript={transcriptData.transcript}
              labelsToSpeaker={transcriptData.labelsToSpeaker || {}}
              knownSpeakers={transcriptData.knownSpeakers || []}
              transcriptId={transcriptId}
              audioPlayerRef={audioPlayerRef}
              filteredSpeaker={filteredSpeaker}
              triggerSpeakerLabel={triggerSpeakerLabel}
              onOpenRelabelModal={handleOpenRelabelModal}
              bottomSpacing={144}
            />
          }
          speakersContent={
            <MobileSpeakersList
              labelsToSpeaker={transcriptData.labelsToSpeaker || {}}
              knownSpeakers={transcriptData.knownSpeakers || []}
              onSpeakerClick={(_speaker, label) => {
                const segmentIndex = transcriptData.transcript?.segments.findIndex(
                  (seg) => seg.speaker === label
                );
                if (segmentIndex !== undefined && segmentIndex !== -1) {
                  setActiveSpeakerLabel(String(segmentIndex));
                }
              }}
            />
          }
          minutesContent={
            <Minutes
              transcriptId={transcriptId}
              minutesData={getMinutesData}
              showSpeakerLabeler={diarizationReady && getMinutesData?.minutes == null}
              showInstructions
              speakerData={transcriptData}
              uploadKind="audio"
              paywallIsShowing={paywallIsShowing}
              layoutKind={layoutKind}
              isPreviewTranscriptDone={isPreviewTranscriptDone}
              transcriptionPaused={transcriptionStatus?.transcribePaused}
              insufficientToken={transcriptionStatus?.insufficientToken}
              hideVersionTabs
              externalSelectedVersion={selectedMinutesVersion}
              onVersionChange={handleMinutesVersionChange}
              onRegenerationStateChange={handleRegenerationStateChange}
            />
          }
          minutesVersions={minutesTabCount}
          selectedMinutesVersion={selectedMinutesVersion}
          onMinutesVersionChange={handleMinutesVersionChange}
          isRegenerating={isRegenerating}
          onExport={() => {
            setIsExportDrawerOpen(true);
          }}
          onMoreActions={() => {
            setIsActionsDrawerOpen(true);
          }}
        />
        {relabelModalState && (
          <RelabelSegmentModal
            isOpen={relabelModalState.isOpen}
            onClose={handleCloseRelabelModal}
            currentSpeakerLabel={relabelModalState.currentSpeakerLabel}
            segmentStart={relabelModalState.segmentStart}
            segmentStop={relabelModalState.segmentStop}
            onRelabelSuccess={handleRelabelSuccess}
            labelsToSpeaker={transcriptData.labelsToSpeaker || {}}
            transcriptId={transcriptId}
          />
        )}
        <MobileSpeakerLabelerDrawer
          activeSegmentKey={activeSpeakerLabel}
          segments={transcriptData.transcript?.segments || []}
          labelsToSpeaker={transcriptData.labelsToSpeaker || {}}
          knownSpeakers={transcriptData.knownSpeakers || []}
          triggerSpeakerLabel={triggerSpeakerLabel}
          onOpenRelabelModal={undefined}
          transcriptId={transcriptId}
          onRequestClose={() => setActiveSpeakerLabel(null)}
          hideCurrentlyEditing
        />
        <MobileExportDrawer
          isOpen={isExportDrawerOpen}
          onClose={() => setIsExportDrawerOpen(false)}
          onCopyMinutes={handleCopyMinutes}
          onCopyTranscript={handleCopyTranscript}
          onExportMinutesDocx={() => handleExportMinutes("docx")}
          onExportMinutesPdf={() => handleExportMinutes("pdf")}
          onExportMinutesTxt={() => {
            const content = getMinutesContent();
            const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
            const title = transcriptionStatus?.title ?? "minutes";
            saveAs(blob, `${title}_GC_Minutes.txt`);
          }}
          onExportTranscriptDocx={() => handleExportTranscript("docx")}
          onExportTranscriptPdf={() => handleExportTranscript("pdf")}
          onExportTranscriptTxt={() => {
            const segments = transcriptData?.transcript?.segments ?? [];
            const labelsToSpeaker = transcriptData?.labelsToSpeaker ?? {};
            const lines = segments.map(
              (seg) =>
                `${labelsToSpeaker[seg.speaker]?.name ?? "Speaker"}: ${seg.transcript}`
            );
            const blob = new Blob([lines.join("\n\n")], { type: "text/plain;charset=utf-8" });
            const title = transcriptionStatus?.title ?? "transcript";
            saveAs(blob, `${title}_GC_Transcript.txt`);
          }}
          minutesData={getMinutesData}
          selectedVersion={selectedMinutesVersion}
          onVersionChange={setSelectedMinutesVersion}
        />
        <MobileTranscriptActionsDrawer
          isOpen={isActionsDrawerOpen}
          onClose={() => setIsActionsDrawerOpen(false)}
          transcriptId={transcriptId}
          onRename={handleRename}
        />
        <RenameTranscriptModal
          isOpen={isRenameModalOpen}
          onClose={() => setIsRenameModalOpen(false)}
          onSuccess={handleRenameSuccess}
          transcriptId={transcriptId}
        />
      </Flex>
    );
  }

  return (
    <Flex flexDir="column" w="full" h="full">
      <ProductTopBar
        transcriptId={transcriptId}
        transcribeFinished={transcribeFinished}
        minutesStatus={getMinutesData?.status}
        uploadComplete={uploadComplete}
        data={transcriptData}
        showProgress={showProgress}
        selectedTabIndex={getMinutesData?.selectedTabIndex}
        getMinutesData={getMinutesData}
      />
      <Flex px={4} py={2} borderBottom="1px solid" borderColor="gray.200" bg="white" justify="center">
        <ButtonGroup size="sm" isAttached variant="outline">
          <Button
            onClick={() => setViewMode("transcript")}
            bg={viewMode === "transcript" ? "blue.500" : "white"}
            color={viewMode === "transcript" ? "white" : "gray.600"}
            borderColor="gray.300"
            _hover={{ bg: viewMode === "transcript" ? "blue.600" : "gray.50" }}
            fontWeight={viewMode === "transcript" ? "semibold" : "normal"}
          >
            Show Transcript
          </Button>
          <Button
            onClick={() => setViewMode("both")}
            bg={viewMode === "both" ? "blue.500" : "white"}
            color={viewMode === "both" ? "white" : "gray.600"}
            borderColor="gray.300"
            _hover={{ bg: viewMode === "both" ? "blue.600" : "gray.50" }}
            fontWeight={viewMode === "both" ? "semibold" : "normal"}
          >
            Show Both
          </Button>
          <Button
            onClick={() => setViewMode("minutes")}
            bg={viewMode === "minutes" ? "blue.500" : "white"}
            color={viewMode === "minutes" ? "white" : "gray.600"}
            borderColor="gray.300"
            _hover={{ bg: viewMode === "minutes" ? "blue.600" : "gray.50" }}
            fontWeight={viewMode === "minutes" ? "semibold" : "normal"}
          >
            Show Minutes
          </Button>
        </ButtonGroup>
      </Flex>
      <Flex gap={2} flex="1" minH="0" w="full">
        {(viewMode === "both" || viewMode === "transcript") && (
          <VStack h="full" w={{ base: "full", lg: viewMode === "both" ? "50%" : "full" }} gap={0.5}>
            <Flex
              w="full"
              h="full"
              flexDir="column"
              border="1px solid"
              borderColor="gray.200"
              borderTopRadius="lg"
              bg="white"
            >
              {showSpeakerLabeler && (
                <Flex borderBottom="1px solid" borderColor="gray.100">
                  <SpeakerLabeler
                    selectedLabel={selectedLabel}
                    setSelectedLabel={setSelectedLabel}
                    onFilterSpeaker={setFilteredSpeaker}
                    layoutKind={layoutKind}
                    labelsToSpeaker={transcriptData.labelsToSpeaker || {}}
                    knownSpeakers={transcriptData.knownSpeakers || []}
                    triggerSpeakerLabel={triggerSpeakerLabel}
                  />
                </Flex>
              )}
              <Flex w="full" h="auto" flexDir="column" bg="white">
                <AudioPlayer
                  audioSrc={audioSrc}
                  onDuration={(duration) => {
                    if (duration != null) {
                      setDuration(duration);
                    }
                  }}
                  onAudioLoadError={(error) => {
                    console.error(error);
                  }}
                  audioPlayerRef={audioPlayerRef}
                />
              </Flex>
              <Transcript
                transcript={transcriptData.transcript}
                labelsToSpeaker={transcriptData.labelsToSpeaker || {}}
                knownSpeakers={transcriptData.knownSpeakers || []}
                transcriptId={transcriptId}
                audioPlayerRef={audioPlayerRef}
                filteredSpeaker={filteredSpeaker}
                triggerSpeakerLabel={triggerSpeakerLabel}
                onOpenRelabelModal={handleOpenRelabelModal}
              />
            </Flex>
          </VStack>
        )}
        {(viewMode === "both" || viewMode === "minutes") && (
          <Flex w={{ base: "full", lg: viewMode === "both" ? "50%" : "full" }} h="full" border="1px solid" borderColor="gray.200" borderTopRadius="lg" bg="white">
            <Minutes
              transcriptId={transcriptId}
              minutesData={getMinutesData}
              showSpeakerLabeler={diarizationReady && getMinutesData?.minutes == null}
              showInstructions
              speakerData={transcriptData}
              uploadKind="audio"
              paywallIsShowing={paywallIsShowing}
              layoutKind={layoutKind}
              isPreviewTranscriptDone={isPreviewTranscriptDone}
              transcriptionPaused={transcriptionStatus?.transcribePaused}
              insufficientToken={transcriptionStatus?.insufficientToken}
              triggerSpeakerLabel={triggerSpeakerLabel}
            />
          </Flex>
        )}
      </Flex>

      {relabelModalState && (
        <RelabelSegmentModal
          isOpen={relabelModalState.isOpen}
          onClose={handleCloseRelabelModal}
          currentSpeakerLabel={relabelModalState.currentSpeakerLabel}
          segmentStart={relabelModalState.segmentStart}
          segmentStop={relabelModalState.segmentStop}
          onRelabelSuccess={handleRelabelSuccess}
          labelsToSpeaker={transcriptData.labelsToSpeaker || {}}
          transcriptId={transcriptId}
        />
      )}
      <RenameTranscriptModal
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        onSuccess={handleRenameSuccess}
        transcriptId={transcriptId}
      />
    </Flex>
  );
};

export default TranscriptController;
