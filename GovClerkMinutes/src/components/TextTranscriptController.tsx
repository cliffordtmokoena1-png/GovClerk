import { Flex, Text, Box, VStack, Image } from "@chakra-ui/react";
import useSWR from "swr";
import { useEffect, useMemo, useState, useCallback } from "react";
import Minutes, { ApiGetMinutesResponseResult } from "./Minutes";
import { LayoutKind } from "@/pages/dashboard/[[...slug]]";
import ProductTopBar from "./ProductTopBar";
import { ApiTranscriptStatusResponseResult } from "@/pages/api/transcript-status";
import { UploadKind } from "@/uploadKind/uploadKind";
import { isZip, unzipFiles } from "@/utils/zip";
import { useConvertDocument } from "@/hooks/useConvertDocument";
import MobileTextTranscriptView from "./mobile/MobileTextTranscriptView";
import MobileExportDrawer from "./mobile/MobileExportDrawer";
import MobileTranscriptActionsDrawer from "./mobile/MobileTranscriptActionsDrawer";
import RenameTranscriptModal from "./RenameTranscriptModal";
import { useExportHandlers } from "@/hooks/useExportHandlers";

type Props = {
  transcriptId: number;
  getMinutesData?: ApiGetMinutesResponseResult;
  uploadUri?: string;
  paywallIsShowing: boolean;
  uploadKind?: UploadKind;
  extension?: string;
  transcribeFinished: boolean;
  layoutKind: LayoutKind;
  showProgress: boolean;
  uploadComplete: boolean;
  transcriptionStatus?: ApiTranscriptStatusResponseResult;
};

export type UploadData =
  | { kind: "image"; data: string[] }
  | { kind: "text"; data: string }
  | { kind: "word"; data: string };

export default function TextTranscriptController({
  transcriptId,
  getMinutesData,
  uploadUri,
  paywallIsShowing,
  uploadKind,
  extension,
  transcribeFinished,
  layoutKind,
  showProgress,
  uploadComplete,
  transcriptionStatus,
}: Props) {
  const { convert } = useConvertDocument();
  const isMobileLayout = layoutKind !== "desktop";

  const [isExportDrawerOpen, setIsExportDrawerOpen] = useState(false);
  const [isActionsDrawerOpen, setIsActionsDrawerOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);

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

  useEffect(() => {
    if (getMinutesData?.selectedTabIndex !== undefined) {
      setSelectedMinutesVersion(getMinutesData.selectedTabIndex);
    }
  }, [getMinutesData?.selectedTabIndex]);

  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleMinutesVersionChange = useCallback((version: number) => {
    setSelectedMinutesVersion(version);
  }, []);

  const handleRegenerationStateChange = useCallback((regenerating: boolean) => {
    setIsRegenerating(regenerating);
  }, []);

  const getMinutesContent = useCallback(
    (versionIndex?: number) => {
      if (!getMinutesData?.minutes) {
        return "";
      }
      const targetVersion = versionIndex !== undefined ? versionIndex : selectedMinutesVersion;
      const selectedMinutes = getMinutesData.minutes[targetVersion];
      return selectedMinutes || "";
    },
    [getMinutesData, selectedMinutesVersion]
  );

  const { handleCopyMinutes, handleCopyTranscript, handleExportMinutes, handleExportTranscript } =
    useExportHandlers({
      transcriptId,
      title: transcriptionStatus?.title,
      transcript: undefined,
      labelsToSpeaker: undefined,
      getMinutesContent,
      minutesData: getMinutesData,
      selectedVersion: selectedMinutesVersion,
    });

  const handleRename = useCallback(() => {
    setIsRenameModalOpen(true);
  }, []);

  const handleRenameSuccess = useCallback(() => {
    setIsRenameModalOpen(false);
  }, []);

  const fetchImageUrls = async (uri: string): Promise<string[]> => {
    const buf = await fetch(uri).then((r) => r.arrayBuffer());
    if (await isZip(buf)) {
      const files = await unzipFiles(buf);
      return files.map((file) => URL.createObjectURL(file));
    } else {
      const blob = new Blob([buf], { type: "image/*" });
      return [URL.createObjectURL(blob)];
    }
  };

  const { data } = useSWR<UploadData | undefined>(
    uploadUri,
    async (uri: string): Promise<UploadData | undefined> => {
      if (uploadKind === "image") {
        const images = await fetchImageUrls(uri);
        return { kind: "image", data: images };
      } else if (uploadKind === "text") {
        const text = await fetch(uri).then((r) => r.text());
        return { kind: "text", data: text };
      } else if (uploadKind === "word") {
        const result = await fetch(uri)
          .then((r) => r.blob())
          .then((blob) => convert({ input: blob, outputType: "html", inputType: extension }));
        if (!result) {
          return undefined;
        }
        return { kind: "word", data: await result.text() };
      } else {
        return undefined;
      }
    }
  );

  const url = useMemo(() => {
    if (data && data.kind === "word") {
      const blob = new Blob([data.data], { type: "text/html;charset=utf-8" });
      return URL.createObjectURL(blob);
    }
    return undefined;
  }, [data]);

  useEffect(() => {
    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [url]);

  if (!uploadKind) {
    return null;
  }

  const renderReferenceContent = () => {
    if (uploadKind === "text") {
      return (
        <Box p={6} w="full">
          <Text as="pre" whiteSpace="pre-wrap">
            {data && data.kind === "text" ? data.data : ""}
          </Text>
        </Box>
      );
    } else if (uploadKind === "image") {
      return (
        <Flex flexDir="column" h="full" w="full">
          {data && data.kind === "image" && Array.isArray(data.data) ? (
            data.data.map((imageUrl, index) => (
              <Image
                key={index}
                src={imageUrl}
                alt={`Uploaded image ${index + 1}`}
                objectFit="contain"
                maxH="100%"
                maxW="100%"
              />
            ))
          ) : (
            <Text>No images available</Text>
          )}
        </Flex>
      );
    } else if (url) {
      return (
        <iframe
          src={url}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            padding: "2rem",
            background: "white",
          }}
        />
      );
    }
    return null;
  };

  if (isMobileLayout) {
    return (
      <Flex flexDir="column" h="full" w="full">
        <MobileTextTranscriptView
          transcriptId={transcriptId}
          transcriptTitle={transcriptionStatus?.title || "Untitled"}
          referenceContent={renderReferenceContent()}
          minutesContent={
            <Minutes
              transcriptId={transcriptId}
              minutesData={getMinutesData}
              showSpeakerLabeler={getMinutesData?.minutes == null}
              showInstructions
              uploadKind={uploadKind}
              paywallIsShowing={paywallIsShowing}
              layoutKind={layoutKind}
              isPreviewTranscriptDone
              transcriptionPaused={transcriptionStatus?.transcribePaused || paywallIsShowing}
              insufficientToken={transcriptionStatus?.insufficientToken || paywallIsShowing}
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
        <MobileExportDrawer
          isOpen={isExportDrawerOpen}
          onClose={() => setIsExportDrawerOpen(false)}
          onCopyMinutes={handleCopyMinutes}
          onCopyTranscript={handleCopyTranscript}
          onExportMinutesDocx={() => handleExportMinutes("docx")}
          onExportMinutesPdf={() => handleExportMinutes("pdf")}
          onExportTranscriptDocx={() => handleExportTranscript("docx")}
          onExportTranscriptPdf={() => handleExportTranscript("pdf")}
          hideTranscript
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
        transcript={data}
        showProgress={showProgress}
        uploadComplete={uploadComplete}
        selectedTabIndex={getMinutesData?.selectedTabIndex}
        getMinutesData={getMinutesData}
      />
      <Flex gap={2} flex="1" minH="0" w="full">
        <VStack h="auto" w={{ base: "full", lg: "50%" }} gap={0.5}>
          <Flex
            w="full"
            h="full"
            flexDir="column"
            border="1px solid"
            borderColor="gray.200"
            borderTopRadius="lg"
            overflowY="auto"
            bg="white"
          >
            <Box h="full">{renderReferenceContent()}</Box>
          </Flex>
        </VStack>

        <Flex w={{ base: "full", lg: "50%" }} h="full">
          <Minutes
            transcriptId={transcriptId}
            minutesData={getMinutesData}
            showSpeakerLabeler={getMinutesData?.minutes == null}
            showInstructions
            uploadKind={uploadKind}
            paywallIsShowing={paywallIsShowing}
            layoutKind={layoutKind}
            isPreviewTranscriptDone
            transcriptionPaused={transcriptionStatus?.transcribePaused || paywallIsShowing}
            insufficientToken={transcriptionStatus?.insufficientToken || paywallIsShowing}
          />
        </Flex>
      </Flex>
      <RenameTranscriptModal
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        onSuccess={handleRenameSuccess}
        transcriptId={transcriptId}
      />
    </Flex>
  );
}
