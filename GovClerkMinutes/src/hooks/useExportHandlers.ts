import { useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import saveAs from "file-saver";
import { safeCapture } from "@/utils/safePosthog";
import { OutputType, useConvertDocument } from "@/hooks/useConvertDocument";
import { TranscriptApiData } from "@/types/types";
import { ApiGetMinutesResponseResult } from "@/components/Minutes";

type ExportHandlersParams = {
  transcriptId?: number;
  title?: string;
  transcript?: TranscriptApiData;
  labelsToSpeaker?: { [key: string]: { name: string } };
  getMinutesContent: (versionIndex?: number) => string;
  minutesData?: ApiGetMinutesResponseResult;
  selectedVersion?: number;
  contentType?: "Minutes" | "Agenda";
};

function formatTranscriptText(
  transcript: TranscriptApiData,
  labelsToSpeaker: { [key: string]: { name: string } }
): string {
  return transcript.segments
    .flatMap((segment, index) => [
      `${index + 1}`,
      `${segment.start} --> ${segment.stop}`,
      `${labelsToSpeaker[segment.speaker]?.name || "Speaker"}: ${segment.transcript}`,
      "",
    ])
    .join("\n");
}

export function useExportHandlers({
  transcriptId,
  title,
  transcript,
  labelsToSpeaker,
  getMinutesContent,
  minutesData,
  selectedVersion,
  contentType = "Minutes",
}: ExportHandlersParams) {
  const toast = useToast();
  const { convert, isLoading: isExporting } = useConvertDocument();

  const handleCopyMinutes = useCallback(async () => {
    if (!transcriptId) {
      return;
    }

    safeCapture("document_exported", {
      transcript_id: transcriptId,
      kind: "minutes_copied",
      version: selectedVersion,
    });

    try {
      const content = getMinutesContent(selectedVersion);
      await navigator.clipboard.writeText(content);

      toast({
        title: "Copied to clipboard",
        description: "Minutes copied successfully",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to copy";
      toast({
        title: "Copy failed",
        description: message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  }, [transcriptId, getMinutesContent, selectedVersion, toast]);

  const handleCopyTranscript = useCallback(async () => {
    if (!transcriptId || !transcript || !labelsToSpeaker) {
      return;
    }

    safeCapture("document_exported", {
      transcript_id: transcriptId,
      kind: "transcript_copied",
    });

    try {
      const transcriptText = formatTranscriptText(transcript, labelsToSpeaker);
      await navigator.clipboard.writeText(transcriptText);

      toast({
        title: "Copied to clipboard",
        description: "Transcript copied successfully",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to copy";
      toast({
        title: "Copy failed",
        description: message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  }, [transcriptId, transcript, labelsToSpeaker, toast]);

  const handleExportMinutes = useCallback(
    async (format: OutputType) => {
      if (!transcriptId || !title) {
        return;
      }

      safeCapture("minutes_exported", {
        transcript_id: transcriptId,
        format,
        version: selectedVersion,
      });

      try {
        const content = getMinutesContent(selectedVersion);
        const blob = await convert({
          input: new Blob([content], { type: "text/markdown" }),
          outputType: format,
          inputType: "gfm",
        });

        if (blob) {
          const versionSuffix =
            selectedVersion !== undefined && minutesData?.minutes && minutesData.minutes.length > 1
              ? `_v${selectedVersion + 1}`
              : "";
          saveAs(blob, `${title}_GC_${contentType}${versionSuffix}.${format}`);
          toast({
            title: `Exported as ${format.toUpperCase()}`,
            status: "success",
            duration: 2000,
            isClosable: true,
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Export failed";
        toast({
          title: "Export failed",
          description: message,
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      }
    },
    [
      transcriptId,
      title,
      getMinutesContent,
      selectedVersion,
      minutesData,
      convert,
      toast,
      contentType,
    ]
  );

  const handleExportTranscript = useCallback(
    async (format: OutputType) => {
      if (!transcriptId || !title || !transcript || !labelsToSpeaker) {
        return;
      }

      safeCapture("transcript_exported", {
        transcript_id: transcriptId,
        format,
      });

      try {
        const transcriptText = formatTranscriptText(transcript, labelsToSpeaker);
        const blob = await convert({
          input: new Blob(["# Transcript\n\n" + transcriptText], { type: "text/markdown" }),
          outputType: format,
          inputType: "gfm",
        });

        if (blob) {
          saveAs(blob, `${title}_GC_Transcript.${format}`);
          toast({
            title: `Exported as ${format.toUpperCase()}`,
            status: "success",
            duration: 2000,
            isClosable: true,
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Export failed";
        toast({
          title: "Export failed",
          description: message,
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      }
    },
    [transcriptId, title, transcript, labelsToSpeaker, convert, toast]
  );

  return {
    handleCopyMinutes,
    handleCopyTranscript,
    handleExportMinutes,
    handleExportTranscript,
    isExporting,
  };
}
