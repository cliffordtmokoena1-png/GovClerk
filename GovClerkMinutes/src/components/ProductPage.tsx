import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Flex, VStack, Spinner, Text, useDisclosure } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { ApiTranscriptStatusResponseResult } from "@/pages/api/transcript-status";
import TranscriptController from "./TranscriptController";
import useNavigationWarningIf from "@/hooks/useNavigationWarning";
import { UploadUriContext } from "./UploadUriProvider";
import MediaUploadInterface from "./upload/MediaUploadInterface";
import H5AudioPlayer from "react-h5-audio-player";
import TextTranscriptController from "./TextTranscriptController";
import { LayoutKind } from "@/pages/dashboard/[[...slug]]";
import PaywallHeader from "./paywall/PaywallHeader";
import InsufficientCreditsOverlay from "./paywall/InsufficientCreditsOverlay";
import useTranscribeSegmentsMutation from "@/hooks/useTranscribeSegmentsMutation";
import useFileUploadHandler from "@/hooks/useFileUploadHandler";
import useRetryUploadHandler from "@/hooks/useRetryUploadHandler";
import useTranscriptManager from "@/hooks/useTranscriptManager";
import { useDropzone } from "react-dropzone";
import ShareTargetConfirmDrawer from "./ShareTargetConfirmDrawer";
import UploadWarningModal from "./UploadWarningModal";
import useSWR from "swr";
import { useAuth } from "@clerk/nextjs";
import { useOrgContext } from "@/contexts/OrgContext";

import UploadProgressScreen from "./UploadProgressScreen";

import RecordingControls from "./upload/RecordingControls";
import LanguagePickerModal from "./LanguagePickerModal";
import { revalidateTranscriptStatus } from "@/revalidations/revalidateTranscriptStatus";
import { useAnnouncements } from "@/contexts/AnnouncementContext";
import { useState as useReactState } from "react";

type Props = {
  transcriptId?: number | null;
  initialTranscriptStatus?: ApiTranscriptStatusResponseResult | null;
  layoutKind: LayoutKind;
  setHighlightGetMinutesButton: (highlight: boolean) => void;
  country: string | null;
  onFilePickerTrigger?: React.MutableRefObject<(() => void) | null>;
  removePadding?: boolean; // Remove horizontal padding for mobile
};

const ProductPage = ({
  transcriptId,
  initialTranscriptStatus,
  layoutKind,
  setHighlightGetMinutesButton,
  country,
  onFilePickerTrigger,
  removePadding = false,
}: Props) => {
  const router = useRouter();
  const { userId, getToken } = useAuth();
  const { orgId } = useOrgContext();
  const [duration, setDuration] = useState<number>();
  const audioPlayerRef = useRef<H5AudioPlayer>(null);
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);
  const [sharedFile, setSharedFile] = useState<File | null>(null);
  const [sharedFileMetadata, setSharedFileMetadata] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const {
    isOpen: isShareDrawerOpen,
    onOpen: onShareDrawerOpen,
    onClose: onShareDrawerClose,
  } = useDisclosure();
  const {
    isOpen: isShareErrorDrawerOpen,
    onOpen: onShareErrorDrawerOpen,
    onClose: onShareErrorDrawerClose,
  } = useDisclosure();

  const { uploadUriMap, updateUploadUri } = useContext(UploadUriContext);
  const uploadUriRecord = transcriptId != null ? uploadUriMap[transcriptId] : null;

  const {
    transcriptStatus,
    mutateTranscriptStatus,
    getMinutesData,
    customerDetails,
    showPaywall,
    showProgress,
    showFinishTranscribingButton,
    transcriptData,
    isTranscriptLoading,
    triggerSpeakerLabel,
    handleSegmentRelabel,
    transcribeFinished,
    isDataReady,
  } = useTranscriptManager({
    transcriptId,
    initialTranscriptStatus,
    country,
  });

  const isRecordingActive = transcriptStatus?.recordingState === "recording";

  // Fetch token balance so we can disable upload/record when the user has no tokens.
  // Using the same SWR key as Sidebar so requests are deduplicated.
  const { data: tokenData } = useSWR<{ tokens: number | null }>(
    userId ? ["/api/get-tokens", userId, orgId] : null,
    async () => {
      await getToken();
      return fetch("/api/get-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, orgId }),
      }).then((res) => res.json());
    },
    { revalidateOnMount: true, refreshInterval: 30000 }
  );
  const tokenBalance = tokenData?.tokens ?? null;

  // Navigation warning if upload is in progress
  useNavigationWarningIf(
    transcriptStatus?.uploadKind !== "audio"
      ? false
      : (uploadUriRecord?.uri != null || transcriptStatus?.audioSrc != null) &&
          !transcriptStatus?.uploadComplete
  );

  // Update audioSrc in context when transcript finishes uploading
  useEffect(() => {
    if (
      transcriptId != null &&
      transcriptStatus?.uploadComplete &&
      transcriptStatus?.uploadKind &&
      transcriptStatus?.title &&
      transcriptStatus.audioSrc != null
    ) {
      if (uploadUriRecord == null) {
        updateUploadUri(transcriptId, {
          uri: transcriptStatus.audioSrc,
          kind: transcriptStatus.uploadKind,
          filename: transcriptStatus.title,
        });
      } else if (uploadUriRecord != null && !uploadUriRecord.uri.startsWith("/api/audio-shim")) {
        updateUploadUri(transcriptId, {
          ...uploadUriRecord,
          uri: transcriptStatus.audioSrc,
        });
      }
    }
  }, [
    transcriptId,
    transcriptStatus?.audioSrc,
    transcriptStatus?.title,
    transcriptStatus?.uploadComplete,
    transcriptStatus?.uploadKind,
    updateUploadUri,
    uploadUriRecord,
  ]);

  // Transcription finish button
  const {
    trigger,
    isMutating,
    data: resumeTranscribeData,
  } = useTranscribeSegmentsMutation(transcriptId);

  const handleRetryUpload = useRetryUploadHandler({
    transcriptStatus,
    mutateTranscriptStatus,
  });

  const { onDrop, isTransitioning, showWarningModal, onWarningAccepted } = useFileUploadHandler({});

  // Create a hidden dropzone for file picker functionality
  const { getInputProps } = useDropzone({
    onDrop,
  });

  // Expose file picker trigger function to parent component
  useEffect(() => {
    if (onFilePickerTrigger && transcriptId == null) {
      const triggerFilePicker = () => {
        hiddenFileInputRef.current?.click();
      };
      onFilePickerTrigger.current = triggerFilePicker;
    }
  }, [onFilePickerTrigger, transcriptId]);

  useEffect(() => {
    const { shared, token, reason, size } = router.query;

    if (shared === "error") {
      const errorMessages: Record<string, string> = {
        file_too_large: `File is too large (${size ? (parseInt(size as string) / 1024 ** 3).toFixed(2) : "unknown"}GB). Maximum file size is 3GB.`,
        multiple_files:
          "Cannot share multiple files. Please share one file at a time (multiple images are allowed).",
        no_file: "No file was shared. Please try again.",
        processing_failed: "Failed to process shared file. Please try again.",
      };

      setShareError(errorMessages[reason as string] || "Failed to share file. Please try again.");
      onShareErrorDrawerOpen();

      const { shared: _, token: __, reason: ___, size: ____, ...restQuery } = router.query;
      router.replace({ pathname: router.pathname, query: restQuery }, undefined, { shallow: true });
      return;
    }

    if (shared === "1" && token && !sharedFile && !transcriptId) {
      const serviceWorker = navigator.serviceWorker?.controller;
      if (!serviceWorker) {
        return;
      }

      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        const { kind, ok, file } = event.data;
        if (kind === "gc_shared_file_response" && ok && file) {
          setSharedFile(file);
          setSharedFileMetadata({
            name: file.name,
            size: file.size,
            type: file.type,
          });
          onShareDrawerOpen();

          serviceWorker.postMessage({ kind: "gc_shared_file_discard", token });
        }
      };

      serviceWorker.postMessage({ kind: "gc_shared_file_request", token }, [messageChannel.port2]);

      const { shared: _, token: __, ...restQuery } = router.query;
      router.replace({ pathname: router.pathname, query: restQuery }, undefined, { shallow: true });
    }
  }, [router, sharedFile, transcriptId, onShareDrawerOpen, onShareErrorDrawerOpen]);

  const handleShareConfirm = useCallback(() => {
    if (sharedFile) {
      onDrop([sharedFile]);
      onShareDrawerClose();
      setSharedFile(null);
      setSharedFileMetadata(null);
    }
  }, [sharedFile, onDrop, onShareDrawerClose]);

  const handleShareCancel = useCallback(() => {
    onShareDrawerClose();
    setSharedFile(null);
    setSharedFileMetadata(null);
  }, [onShareDrawerClose]);

  // Highlight the "Get Minutes" button if transcribe is finished
  useEffect(() => {
    setHighlightGetMinutesButton(!!transcriptStatus?.transcribeFinished);
  }, [setHighlightGetMinutesButton, transcriptStatus?.transcribeFinished]);

  const { addAnnouncement, dismissAnnouncement } = useAnnouncements();
  const [languagePickerOpen, setLanguagePickerOpen] = useReactState(
    transcriptStatus?.language === "pending"
  );
  const { isOpen: isPaywallOpen, onOpen: onPaywallOpen, onClose: onPaywallClose } = useDisclosure();
  const paywallAnnouncementIdRef = useRef<string | null>(null);
  const finishMinutesAnnouncementIdRef = useRef<string | null>(null);
  const languageAnnouncementIdRef = useRef<string | null>(null);

  useEffect(() => {
    const shouldShowLanguage = transcriptId != null && transcriptStatus?.language === "pending";

    if (shouldShowLanguage && languageAnnouncementIdRef.current == null) {
      const id = addAnnouncement({
        text: "Select a language to continue",
        variant: "info",
        action: () => setLanguagePickerOpen(true),
        actionText: "Set language",
        dismissible: false,
        transcriptId,
      });
      languageAnnouncementIdRef.current = id;
    } else if (!shouldShowLanguage && languageAnnouncementIdRef.current != null) {
      dismissAnnouncement(languageAnnouncementIdRef.current);
      languageAnnouncementIdRef.current = null;
    }
  }, [
    transcriptId,
    transcriptStatus?.language,
    addAnnouncement,
    dismissAnnouncement,
    setLanguagePickerOpen,
  ]);

  const handleFinishMinutes = useCallback(async () => {
    if (isMutating || resumeTranscribeData != null) {
      return;
    }

    if (finishMinutesAnnouncementIdRef.current != null) {
      dismissAnnouncement(finishMinutesAnnouncementIdRef.current);
      finishMinutesAnnouncementIdRef.current = null;
    }

    if (transcriptId != null) {
      await trigger();
      await revalidateTranscriptStatus(transcriptId);
    }
  }, [isMutating, resumeTranscribeData, dismissAnnouncement, transcriptId, trigger]);

  useEffect(() => {
    const shouldShowFinishMinutes = transcriptId != null && showFinishTranscribingButton;

    if (shouldShowFinishMinutes && finishMinutesAnnouncementIdRef.current == null) {
      const id = addAnnouncement({
        text: "Your subscription is active! Click here to finish your minutes.",
        variant: "success",
        action: handleFinishMinutes,
        actionText: isMutating ? "Generating..." : "Finish Minutes",
        dismissible: false,
        transcriptId,
      });
      finishMinutesAnnouncementIdRef.current = id;
    } else if (!shouldShowFinishMinutes && finishMinutesAnnouncementIdRef.current != null) {
      dismissAnnouncement(finishMinutesAnnouncementIdRef.current);
      finishMinutesAnnouncementIdRef.current = null;
    }
  }, [
    transcriptId,
    showFinishTranscribingButton,
    isMutating,
    addAnnouncement,
    dismissAnnouncement,
    handleFinishMinutes,
  ]);

  useEffect(() => {
    const shouldShowPaywall =
      transcriptId != null &&
      showPaywall &&
      transcriptStatus?.currentBalance != null &&
      transcriptStatus?.tokensRequired != null &&
      transcriptStatus.currentBalance < transcriptStatus.tokensRequired;

    if (shouldShowPaywall && paywallAnnouncementIdRef.current == null) {
      const uploadKindText = transcriptStatus.uploadKind === "audio" ? "recording" : "transcript";
      const tokenText = transcriptStatus.currentBalance === 1 ? "token" : "tokens";
      const id = addAnnouncement({
        text: `This ${uploadKindText} requires **${transcriptStatus.tokensRequired}** tokens, but you only have **${transcriptStatus.currentBalance}** ${tokenText}.`,
        variant: "warning",
        action: onPaywallOpen,
        actionText: "Upgrade Now",
        dismissible: false,
        transcriptId,
      });
      paywallAnnouncementIdRef.current = id;
    } else if (!shouldShowPaywall && paywallAnnouncementIdRef.current != null) {
      dismissAnnouncement(paywallAnnouncementIdRef.current);
      paywallAnnouncementIdRef.current = null;
    }
  }, [
    transcriptId,
    showPaywall,
    transcriptStatus?.currentBalance,
    transcriptStatus?.tokensRequired,
    transcriptStatus?.uploadKind,
    addAnnouncement,
    dismissAnnouncement,
    onPaywallOpen,
  ]);

  if (transcriptStatus == null) {
    return null;
  }

  return (
    <Flex
      id="product-page"
      key={transcriptId}
      direction="column"
      alignItems={
        transcriptStatus.audioSrc == null && uploadUriRecord?.uri == null ? "center" : "start"
      }
      justifyContent={
        transcriptStatus.audioSrc == null && uploadUriRecord?.uri == null ? "center" : "start"
      }
      px={removePadding ? 0 : 2}
      w="full"
      flex={1}
      minH={0}
      overflowY={transcriptId == null ? "visible" : "auto"}
      alignSelf={
        uploadUriRecord?.uri == null && transcriptStatus.audioSrc == null ? "center" : "unset"
      }
    >
      {transcriptId == null && (
        <input {...getInputProps()} ref={hiddenFileInputRef} style={{ display: "none" }} />
      )}

      {transcriptId == null ? (
        <Flex w="full" h="full" pt={2} alignItems="center" justifyContent="center">
          <MediaUploadInterface
            onDrop={onDrop}
            isTransitioning={isTransitioning}
            isSupported={typeof window !== "undefined" && "MediaRecorder" in window}
            layoutKind={layoutKind}
            tokenBalance={tokenBalance}
            onUpgradeClick={onPaywallOpen}
          />
        </Flex>
      ) : null}

      {transcriptStatus?.language === "pending" && transcriptId != null && (
        <LanguagePickerModal
          isOpen={languagePickerOpen}
          onClose={() => setLanguagePickerOpen(false)}
          country={country ?? "ZA"}
          transcriptId={transcriptId}
        />
      )}

      {showPaywall &&
        transcriptStatus?.currentBalance != null &&
        transcriptStatus?.tokensRequired != null &&
        transcriptStatus.currentBalance < transcriptStatus.tokensRequired && (
          <PaywallHeader
            isOpen={isPaywallOpen}
            onClose={onPaywallClose}
            tokensRequired={transcriptStatus.tokensRequired}
            currentBalance={transcriptStatus.currentBalance}
            uploadKind={transcriptStatus.uploadKind}
            country={country ?? undefined}
            transcriptId={transcriptId}
            planName={customerDetails?.planName ?? "Free"}
          />
        )}

      {transcriptStatus?.transcribePaused &&
        transcriptStatus?.tokensRequired != null &&
        transcriptStatus?.currentBalance != null &&
        transcriptStatus.currentBalance < transcriptStatus.tokensRequired && (
          <InsufficientCreditsOverlay
            tokensRequired={transcriptStatus.tokensRequired}
            currentBalance={transcriptStatus.currentBalance}
            onAddCredits={onPaywallOpen}
            transcriptId={transcriptId}
            onBalanceSufficient={() => {
              // Refresh transcript status and trigger resume of paused transcripts.
              revalidateTranscriptStatus(transcriptId ?? undefined);
              fetch("/api/resume-paused-transcripts", { method: "POST" }).catch((err) => {
                console.error("[ProductPage] Failed to resume paused transcripts:", err);
              });
            }}
          />
        )}

      <Flex w="full" flex="1" flexDir="column" minH="0">
        {transcriptId != null ? (
          <Flex w="full" h="full" flex="1" minH="0">
            {isRecordingActive ? (
              <Flex w="full" h="full" alignItems="center" justifyContent="center">
                <RecordingControls transcriptId={transcriptId} />
              </Flex>
            ) : !transcriptStatus.uploadComplete || transcriptStatus.transcribeFailed ? (
              <Flex w="full" h="full" alignItems="center" justifyContent="center">
                <UploadProgressScreen
                  transcriptId={transcriptId}
                  uploadComplete={!!transcriptStatus.uploadComplete}
                  transcribeFinished={!!transcriptStatus.transcribeFinished}
                  transcribeFailed={!!transcriptStatus.transcribeFailed}
                  uploadStalled={
                    !uploadUriRecord?.uri && !!transcriptId && !!transcriptStatus.uploadComplete
                  }
                  transcribeFailedMessage={transcriptStatus.transcribeFailedMessage}
                  // Use transcript title for consistency with sidebar
                  transcriptTitle={transcriptStatus.title}
                  // Retry upload using the file from IndexedDB
                  onUploadRetry={handleRetryUpload}
                  // Return to dashboard
                  onRetry={() => router.push("/dashboard")}
                />
              </Flex>
            ) : !uploadUriRecord?.uri || !transcriptData ? (
              // Show loading state for completed transcripts while data is loading

              <Flex w="full" h="full" flex="1" alignItems="center" justifyContent="center">
                <VStack spacing={4}>
                  <Spinner size="lg" color="blue.500" thickness="3px" />
                  <Text color="gray.600" fontSize="md">
                    Loading transcript...
                  </Text>
                </VStack>
              </Flex>
            ) : uploadUriRecord?.kind === "audio" ? (
              <TranscriptController
                transcriptId={transcriptId}
                transcribeFinished={transcribeFinished}
                showSpeakerLabeler={
                  transcriptStatus.transcribeFinished || transcriptStatus.previewTranscribeFinished
                }
                audioSrc={uploadUriRecord?.uri}
                setDuration={setDuration}
                diarizationReady={!!transcriptStatus.diarizationReady}
                getMinutesData={getMinutesData}
                audioPlayerRef={audioPlayerRef}
                paywallIsShowing={!!showPaywall}
                layoutKind={layoutKind}
                uploadComplete={!!transcriptStatus.uploadComplete}
                showProgress={showProgress}
                transcriptionStatus={transcriptStatus}
                transcriptData={transcriptData}
                triggerSpeakerLabel={triggerSpeakerLabel}
                handleSegmentRelabel={handleSegmentRelabel}
              />
            ) : (
              <TextTranscriptController
                transcriptId={transcriptId}
                uploadUri={uploadUriRecord?.uri}
                getMinutesData={getMinutesData}
                paywallIsShowing={!!showPaywall}
                uploadKind={transcriptStatus.uploadKind}
                extension={transcriptStatus.extension}
                transcribeFinished={!!transcriptStatus.transcribeFinished}
                layoutKind={layoutKind}
                uploadComplete={!!transcriptStatus.uploadComplete}
                showProgress={showProgress}
                transcriptionStatus={transcriptStatus}
              />
            )}
          </Flex>
        ) : null}
      </Flex>

      {/* Share Target Confirmation Drawer */}
      {sharedFileMetadata && (
        <ShareTargetConfirmDrawer
          isOpen={isShareDrawerOpen}
          onClose={handleShareCancel}
          onConfirm={handleShareConfirm}
          fileName={sharedFileMetadata.name}
          fileSize={sharedFileMetadata.size}
          fileType={sharedFileMetadata.type}
        />
      )}

      {/* Share Target Error Drawer */}
      {shareError && (
        <ShareTargetConfirmDrawer
          isOpen={isShareErrorDrawerOpen}
          onClose={() => {
            onShareErrorDrawerClose();
            setShareError(null);
          }}
          onConfirm={() => {
            onShareErrorDrawerClose();
            setShareError(null);
          }}
          fileName="Error"
          fileSize={0}
          fileType=""
          isError
          errorMessage={shareError}
        />
      )}

      <UploadWarningModal isOpen={showWarningModal} onAccept={onWarningAccepted} />
    </Flex>
  );
};

export default ProductPage;
