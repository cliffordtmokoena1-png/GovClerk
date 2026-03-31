import { useState, useEffect } from "react";
import {
  Box,
  Flex,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Button,
  useToast,
  MenuGroup,
  MenuDivider,
  Text,
} from "@chakra-ui/react";
import { FiChevronDown, FiCopy, FiFileText } from "react-icons/fi";
import Image from "next/image";
import saveAs from "file-saver";
import { safeCapture } from "@/utils/safePosthog";
import { ApiLabelSpeakerResponseResult1 } from "@/pages/api/label-speaker";
import { TranscriptApiData } from "@/types/types";
import { UploadData } from "./TextTranscriptController";
import { OutputType, useConvertDocument, useConvertImages } from "@/hooks/useConvertDocument";
import { ApiGetMinutesResponseResult } from "./Minutes";

type Props = {
  transcriptId?: number;
  data?: ApiLabelSpeakerResponseResult1;
  transcript?: UploadData;
  isProcessing: boolean;
  uploadUriMap: { [key: number]: { filename: string } };
  getMinutesContent: (versionIndex?: number) => string;
  minutesData?: ApiGetMinutesResponseResult;
  selectedTabIndex?: number;
};

function createVtt(
  transcript: TranscriptApiData,
  labelsToSpeaker: { [key: string]: { name: string } }
): string {
  let vtt = "";
  let index = 1;
  for (const segment of transcript.segments) {
    vtt += `${index}\n`;
    vtt += `${segment.start} --> ${segment.stop}\n`;
    vtt += `${labelsToSpeaker[segment.speaker]?.name || "Speaker"}: ${segment.transcript}\n\n`;
    index += 1;
  }
  return vtt;
}

export default function ExportButton({
  transcriptId,
  data,
  transcript,
  isProcessing,
  uploadUriMap,
  getMinutesContent,
  minutesData,
  selectedTabIndex,
}: Props) {
  const toast = useToast();

  const { convert, isLoading: isMdLoading } = useConvertDocument();
  const { convertImages, isLoading: isImgLoading } = useConvertImages();
  const isExporting = isMdLoading || isImgLoading;

  const [selectedExportVersion, setSelectedExportVersion] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (minutesData?.minutes && minutesData.minutes.length > 1) {
      setSelectedExportVersion(minutesData.minutes.length - 1);
    } else {
      setSelectedExportVersion(selectedTabIndex);
    }
  }, [selectedTabIndex, minutesData?.minutes]);

  const handleCopy = (type: "transcript" | "minutes") => {
    if (!transcriptId) {
      return;
    }

    safeCapture("document_exported", {
      transcript_id: transcriptId,
      kind: `${type}_copied`,
    });

    if (type === "transcript") {
      if (data && data.transcript != null && data.labelsToSpeaker != null) {
        const vtt = createVtt(data.transcript, data.labelsToSpeaker);
        navigator.clipboard.writeText(vtt);
      } else if (transcript != null) {
        if (transcript.kind !== "image") {
          navigator.clipboard.writeText(transcript.data ?? "");
        }
      }
    } else {
      navigator.clipboard.writeText(getMinutesContent(selectedExportVersion));
    }
  };

  const handleExport = async (
    type: "transcript" | "minutes",
    format: OutputType,
    versionIndex?: number
  ) => {
    if (!transcriptId) {
      return;
    }

    safeCapture("document_exported", {
      transcript_id: transcriptId,
      kind: `${type}_${format}_exported`,
      version: versionIndex,
    });

    try {
      if (type === "transcript") {
        await handleTranscriptExport(format);
      } else {
        await handleMinutesExport(format, versionIndex);
      }
    } catch (err) {
      console.error("Export failed", err);
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : String(err),
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const handleTranscriptExport = async (format: OutputType) => {
    if (!transcriptId) {
      return;
    }

    safeCapture("transcript_exported", {
      transcript_id: transcriptId,
      format,
    });

    const transcriptFilename = uploadUriMap[transcriptId]?.filename ?? "Transcript";

    if (data && data.transcript != null && data.labelsToSpeaker != null) {
      const vtt = createVtt(data.transcript, data.labelsToSpeaker);
      const blob = await convert({
        input: new Blob(["# Transcript\n\n" + vtt], { type: "text/markdown" }),
        outputType: format,
        inputType: "gfm",
      });
      if (blob) {
        saveAs(blob, `${transcriptFilename}_GC_Transcript.${format}`);
      }
    } else if (transcript != null) {
      if (transcript.kind === "image") {
        const blob = await convertImages({
          urls: transcript.data as string[],
          outputType: format,
        });
        if (blob) {
          saveAs(blob, `${transcriptFilename}_GC_Transcript.${format}`);
        }
      } else {
        const blob = await convert({
          input: new Blob([transcript.data ?? ""], { type: "text/markdown" }),
          outputType: format,
          inputType: "html",
        });
        if (blob) {
          saveAs(blob, `${transcriptFilename}_GC_Transcript.${format}`);
        }
      }
    }
  };

  const handleMinutesExport = async (format: OutputType, versionIndex?: number) => {
    if (!transcriptId) {
      return;
    }

    safeCapture("minutes_exported", {
      transcript_id: transcriptId,
      format,
      version: versionIndex,
    });

    const blob = await convert({
      input: new Blob([getMinutesContent(versionIndex)], { type: "text/markdown" }),
      outputType: format,
      inputType: "gfm",
    });
    if (blob) {
      const versionSuffix =
        versionIndex !== undefined && minutesData?.minutes && minutesData.minutes.length > 1
          ? `_v${versionIndex + 1}`
          : "";
      const minutesFilename = uploadUriMap[transcriptId]?.filename ?? "Minutes";
      saveAs(blob, `${minutesFilename}_GC_Minutes${versionSuffix}.${format}`);
    }
  };

  const handleExportText = (type: "transcript" | "minutes", versionIndex?: number) => {
    if (!transcriptId) {
      return;
    }

    safeCapture("document_exported", {
      transcript_id: transcriptId,
      kind: `${type}_txt_exported`,
      version: versionIndex,
    });

    const filename = uploadUriMap[transcriptId]?.filename ?? "document";

    if (type === "minutes") {
      const content = getMinutesContent(versionIndex);
      const versionSuffix =
        versionIndex !== undefined && minutesData?.minutes && minutesData.minutes.length > 1
          ? `_v${versionIndex + 1}`
          : "";
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      saveAs(blob, `${filename}_GC_Minutes${versionSuffix}.txt`);
    } else {
      let content = "";
      if (data && data.transcript != null && data.labelsToSpeaker != null) {
        content = createVtt(data.transcript, data.labelsToSpeaker);
      } else if (transcript != null && transcript.kind !== "image") {
        content = transcript.data ?? "";
      }
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      saveAs(blob, `${filename}_GC_Transcript.txt`);
    }
  };

  return (
    <Menu>
      <MenuButton
        as={Button}
        rightIcon={<FiChevronDown />}
        colorScheme="blue"
        size="sm"
        isDisabled={isProcessing || isExporting}
        isLoading={isExporting}
        px={{ base: 2, md: 4 }}
      >
        Retrieve File
      </MenuButton>
      <MenuList>
        <MenuGroup title="Minutes">
          {minutesData?.minutes &&
            minutesData.minutes.length > 1 &&
            (() => {
              const latestVersion = minutesData.minutes.length - 1;
              const currentVersion =
                selectedExportVersion !== undefined ? selectedExportVersion : latestVersion;
              return (
                <Box px={3} py={2}>
                  <Text fontSize="xs" color="gray.600" mb={1} fontWeight="500">
                    Select version
                  </Text>
                  <Menu placement="bottom" closeOnSelect gutter={0} matchWidth>
                    <MenuButton
                      as={Button}
                      rightIcon={<FiChevronDown />}
                      size="sm"
                      variant="outline"
                      width="full"
                      textAlign="left"
                      fontWeight="normal"
                      borderColor="gray.300"
                      h="32px"
                      px={3}
                    >
                      Version {currentVersion + 1}
                    </MenuButton>
                    <MenuList minW="auto" maxW="100%">
                      {minutesData?.minutes?.map((_, index) => {
                        const isSelected = index === currentVersion;
                        const isLatest = index === (minutesData?.minutes?.length ?? 0) - 1;
                        return (
                          <MenuItem
                            key={index}
                            onClick={() => setSelectedExportVersion(index)}
                            bg={isSelected ? "gray.100" : "white"}
                            _hover={{ bg: "blue.50" }}
                          >
                            Version {index + 1}
                            {isLatest && " (latest)"}
                          </MenuItem>
                        );
                      })}
                    </MenuList>
                  </Menu>
                </Box>
              );
            })()}
          <MenuItem onClick={() => handleExport("minutes", "pdf", selectedExportVersion)}>
            <Flex alignItems="center" gap={2}>
              <Box boxSize={4}>
                <Image src="/pdf.svg" alt="PDF Logo" width={16} height={16} />
              </Box>
              Minutes in PDF
            </Flex>
          </MenuItem>
          <MenuItem onClick={() => handleExport("minutes", "docx", selectedExportVersion)}>
            <Flex alignItems="center" gap={2}>
              <Box boxSize={4}>
                <Image src="/word.svg" alt="Microsoft Word Logo" width={16} height={16} />
              </Box>
              Minutes in Word
            </Flex>
          </MenuItem>
          <MenuItem onClick={() => handleExportText("minutes", selectedExportVersion)}>
            <Flex alignItems="center" gap={2}>
              <FiFileText size={16} />
              Minutes in Text
            </Flex>
          </MenuItem>
          <MenuItem onClick={() => handleCopy("minutes")}>
            <Flex alignItems="center" gap={2}>
              <FiCopy size={16} />
              Copy minutes
            </Flex>
          </MenuItem>
        </MenuGroup>

        <MenuDivider />

        <MenuGroup title="Transcript">
          <MenuItem onClick={() => handleExport("transcript", "pdf")}>
            <Flex alignItems="center" gap={2}>
              <Box boxSize={4}>
                <Image src="/pdf.svg" alt="PDF Logo" width={16} height={16} />
              </Box>
              Transcript in PDF
            </Flex>
          </MenuItem>
          <MenuItem onClick={() => handleExport("transcript", "docx")}>
            <Flex alignItems="center" gap={2}>
              <Box boxSize={4}>
                <Image src="/word.svg" alt="Microsoft Word Logo" width={16} height={16} />
              </Box>
              Transcript in Word
            </Flex>
          </MenuItem>
          <MenuItem onClick={() => handleExportText("transcript")}>
            <Flex alignItems="center" gap={2}>
              <FiFileText size={16} />
              Transcript in Text
            </Flex>
          </MenuItem>
          <MenuItem onClick={() => handleCopy("transcript")}>
            <Flex alignItems="center" gap={2}>
              <FiCopy size={16} />
              Copy transcript
            </Flex>
          </MenuItem>
        </MenuGroup>
      </MenuList>
    </Menu>
  );
}
