import React, { useContext, useState, useEffect } from "react";
import {
  Box,
  Flex,
  Text,
  Spinner,
  Progress,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  VStack,
  Heading,
  Button,
  Icon,
  Divider,
  Link,
  Tooltip,
  useToast,
} from "@chakra-ui/react";
import useUploadProgress from "@/hooks/useUploadProgress";
import { UploadUriContext } from "./UploadUriProvider";
import { getFileFromStorage, getTranscriptRecordFromStorage } from "@/common/indexeddb";
import { uploadWithAdaptiveConcurrency, DEFAULT_OPTIONS } from "@/common/adaptiveConcurrency";
import { useRouter } from "next/router";
import { safeCapture } from "@/utils/safePosthog";
import { isDev } from "@/utils/dev";
import { TOP_BAR_HEIGHT_PX } from "./ProductTopBar";
import {
  MdErrorOutline,
  MdOutlineArrowBack,
  MdRefresh,
  MdDashboard,
  MdAudiotrack,
} from "react-icons/md";
import { openWhatsAppChat } from "@/utils/whatsapp";

type Props = {
  transcriptId?: number;
  uploadComplete?: boolean;
  transcribeFinished?: boolean;
  onRetry?: () => void;
  onUploadRetry?: (transcriptId: number) => Promise<void>;
  transcribeFailedMessage?: string;
  transcribeFailed?: boolean;
  uploadStalled?: boolean;
  transcriptTitle?: string;
};

export default function UploadProgressScreen({
  transcriptId,
  uploadComplete,
  transcribeFinished,
  onRetry,
  onUploadRetry,
  transcribeFailedMessage,
  transcribeFailed,
  uploadStalled,
  transcriptTitle,
}: Props) {
  const { chunksUploaded, totalChunks, uploadProgressError } = useUploadProgress(transcriptId);
  const [fileExistsInIndexedDB, setFileExistsInIndexedDB] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [isRetryTranscriptionInProgress, setIsRetryTranscriptionInProgress] =
    useState<boolean>(false);
  const [isRetryInProgress, setIsRetryInProgress] = useState<boolean>(false);
  const router = useRouter();
  const toast = useToast();
  const { uploadUriMap } = useContext(UploadUriContext);
  const uploadUriRecord = transcriptId != null ? uploadUriMap[transcriptId] : null;
  const fileName = transcriptTitle || uploadUriRecord?.filename || "File";

  const percentComplete = totalChunks > 0 ? Math.floor((100.0 * chunksUploaded) / totalChunks) : 0;

  const showError = (transcribeFailed || uploadStalled) && !isRetryInProgress;

  // Force uploading status when retry is in progress
  const isUploading = !uploadComplete || isRetryInProgress;

  const getStatusMessage = () => {
    if (isRetryInProgress) {
      return "Retrying upload...";
    }

    if (transcribeFailed) {
      return "Transcription failed";
    }

    if (uploadStalled) {
      return "Upload failed";
    }

    if (!uploadComplete) {
      return "Uploading recording...";
    }

    if (!transcribeFinished) {
      return "Processing your recording...";
    }

    return "Finalizing document...";
  };

  // Check if the file exists in IndexedDB
  useEffect(() => {
    async function checkFile() {
      if (transcriptId && (uploadStalled || uploadProgressError)) {
        try {
          const file = await getFileFromStorage(transcriptId);
          const transcript = await getTranscriptRecordFromStorage(transcriptId);
          setFileExistsInIndexedDB(file !== undefined && transcript !== undefined);
        } catch (err) {
          console.error("Error checking IndexedDB:", err);
          setFileExistsInIndexedDB(false);
        }
      }
    }

    checkFile();
  }, [transcriptId, uploadStalled, uploadProgressError]);

  const handleRetryUpload = async () => {
    if (!transcriptId || !fileExistsInIndexedDB) {
      return;
    }

    setIsRetrying(true);
    setIsRetryInProgress(true);

    try {
      if (onUploadRetry) {
        await onUploadRetry(transcriptId);
      }
    } catch (err) {
      console.error("Error retrying upload:", err);
      safeCapture("retry_upload_error", {
        transcript_id: transcriptId,
        error: err instanceof Error ? err.message : String(err),
      });
      setIsRetryInProgress(false);
    } finally {
      setIsRetrying(false);
    }
  };

  const getErrorMessage = () => {
    if (transcribeFailed && transcribeFailedMessage) {
      return transcribeFailedMessage;
    }

    if (uploadStalled) {
      return "The upload process was interrupted or failed to complete. Please try again.";
    }

    return "There was an error processing your file.";
  };

  return (
    <Flex
      flexDir="column"
      w="full"
      h="full"
      alignItems="center"
      justifyContent="center"
      bg="white"
      pt={`${TOP_BAR_HEIGHT_PX}px`}
      px={4}
    >
      <VStack spacing={6} align="center" maxW="700px" w="full">
        {showError ? (
          <Box w="full" py={8}>
            <VStack spacing={8} align="center">
              <Icon as={MdErrorOutline} w={20} h={20} color="red.500" opacity={0.9} />

              <VStack spacing={2}>
                <Heading size="lg" color="gray.700" fontWeight="semibold">
                  {uploadStalled ? "Upload Failed" : "Transcription Failed"}
                </Heading>
                <Text color="gray.500" fontSize="md" textAlign="center" maxW="md">
                  {getErrorMessage()}
                </Text>

                <Text fontSize="xs" color="gray.400" textAlign="center" mt={2} maxW="sm">
                  No charges were applied for this failed process.
                  <br />
                  If you believe you were charged in error,{" "}
                  <Link
                    color="blue.500"
                    onClick={(e) => {
                      e.preventDefault();
                      openWhatsAppChat(
                        "Hi, I need help with a failed upload. Can you assist?",
                        "upload_progress_screen"
                      );
                    }}
                    cursor="pointer"
                    textDecoration="underline"
                  >
                    contact support
                  </Link>
                  .
                </Text>
              </VStack>

              <Flex mt={6} direction="column" gap={3} width="full" maxW="md" alignItems="center">
                {/* Retry transcription: shown when the pipeline failed but the file is already on S3 */}
                {transcribeFailed && transcriptId && (
                  <Button
                    size="md"
                    colorScheme="blue"
                    bg="#152a4e"
                    color="white"
                    _hover={{ bg: "#1a3260" }}
                    onClick={async () => {
                      setIsRetryTranscriptionInProgress(true);
                      try {
                        await fetch(`/api/resume-transcribe?transcriptId=${transcriptId}`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({}),
                        });
                        safeCapture("retry_transcription", { transcript_id: transcriptId });
                        // Navigate to dashboard so the status refreshes
                        router.push("/dashboard");
                      } catch (err) {
                        console.error("[UploadProgressScreen] retry transcription error:", err);
                        toast({
                          title: "Retry failed",
                          description: "Unable to retry transcription. Please try again later.",
                          status: "error",
                          duration: 5000,
                          isClosable: true,
                        });
                      } finally {
                        setIsRetryTranscriptionInProgress(false);
                      }
                    }}
                    px={8}
                    borderRadius="full"
                    boxShadow="sm"
                    _active={{ transform: "scale(0.98)" }}
                    isLoading={isRetryTranscriptionInProgress}
                    loadingText="Retrying..."
                    width="full"
                    maxW="xs"
                    leftIcon={<Icon as={MdRefresh} />}
                  >
                    Retry Transcription
                  </Button>
                )}

                <Tooltip
                  isDisabled={fileExistsInIndexedDB || !uploadStalled}
                  label="Original file data is no longer available. Please upload the file again."
                  placement="top"
                  hasArrow
                >
                  <Button
                    size="md"
                    colorScheme={!fileExistsInIndexedDB || !uploadStalled ? "gray" : "blue"}
                    onClick={handleRetryUpload}
                    px={8}
                    borderRadius="full"
                    boxShadow="sm"
                    _hover={{
                      boxShadow:
                        !fileExistsInIndexedDB || !uploadStalled ? {} : { boxShadow: "md" },
                    }}
                    isLoading={isRetrying}
                    loadingText="Retrying"
                    width="full"
                    maxW="xs"
                    isDisabled={!fileExistsInIndexedDB || !uploadStalled}
                    opacity={!fileExistsInIndexedDB || !uploadStalled ? 0.6 : 1}
                    cursor={!fileExistsInIndexedDB || !uploadStalled ? "not-allowed" : "pointer"}
                    leftIcon={<Icon as={MdRefresh} />}
                  >
                    Retry Upload
                  </Button>
                </Tooltip>

                <Button
                  size="md"
                  colorScheme={fileExistsInIndexedDB && uploadStalled ? "gray" : "blue"}
                  onClick={onRetry}
                  px={8}
                  borderRadius="full"
                  boxShadow="sm"
                  _hover={{ boxShadow: "md" }}
                  variant={fileExistsInIndexedDB && uploadStalled ? "outline" : "solid"}
                  width="full"
                  maxW="xs"
                  isDisabled={!onRetry}
                  leftIcon={<Icon as={MdDashboard} />}
                >
                  Return to Dashboard
                </Button>
              </Flex>
            </VStack>
          </Box>
        ) : (
          <Box
            w="full"
            py={10}
            px={8}
            bg="white"
            border="1px solid"
            borderColor="gray.100"
            borderRadius="xl"
            boxShadow="0 4px 24px rgba(66, 153, 225, 0.10), 0 1px 4px rgba(0,0,0,0.06)"
            position="relative"
            overflow="hidden"
          >
            {/* Subtle gradient accent bar at top */}
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              h="3px"
              bgGradient="linear(to-r, blue.400, purple.400)"
              borderRadius="xl xl 0 0"
            />

            <VStack spacing={8} align="center">
              {/* Display filename prominently */}
              <VStack spacing={1}>
                <Heading size="md" color="gray.800" fontWeight="bold" textAlign="center">
                  {fileName}
                </Heading>
                <Text color="gray.500" fontSize="sm" fontWeight="medium">
                  {getStatusMessage()}
                </Text>
              </VStack>

              {/* Step indicators */}
              <Flex w="full" maxW="sm" alignItems="center" justifyContent="center" gap={0}>
                {/* Step 1: Upload */}
                <Flex direction="column" alignItems="center" flex={1}>
                  <Box
                    w={7}
                    h={7}
                    borderRadius="full"
                    bg={uploadComplete ? "blue.500" : isUploading ? "blue.500" : "gray.200"}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text fontSize="xs" color="white" fontWeight="bold">
                      1
                    </Text>
                  </Box>
                  <Text
                    fontSize="xs"
                    color={uploadComplete || isUploading ? "blue.600" : "gray.400"}
                    mt={1}
                    fontWeight={isUploading ? "semibold" : "normal"}
                  >
                    Upload
                  </Text>
                </Flex>
                {/* Connector */}
                <Box
                  flex={2}
                  h="2px"
                  bg={uploadComplete ? "blue.400" : "gray.200"}
                  mb={4}
                  style={{ transition: "background 0.4s" }}
                />
                {/* Step 2: Processing */}
                <Flex direction="column" alignItems="center" flex={1}>
                  <Box
                    w={7}
                    h={7}
                    borderRadius="full"
                    bg={
                      transcribeFinished
                        ? "blue.500"
                        : uploadComplete && !transcribeFinished
                          ? "blue.500"
                          : "gray.200"
                    }
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text fontSize="xs" color="white" fontWeight="bold">
                      2
                    </Text>
                  </Box>
                  <Text
                    fontSize="xs"
                    color={uploadComplete ? "blue.600" : "gray.400"}
                    mt={1}
                    fontWeight={uploadComplete && !transcribeFinished ? "semibold" : "normal"}
                  >
                    Process
                  </Text>
                </Flex>
                {/* Connector */}
                <Box
                  flex={2}
                  h="2px"
                  bg={transcribeFinished ? "blue.400" : "gray.200"}
                  mb={4}
                  style={{ transition: "background 0.4s" }}
                />
                {/* Step 3: Complete */}
                <Flex direction="column" alignItems="center" flex={1}>
                  <Box
                    w={7}
                    h={7}
                    borderRadius="full"
                    bg={transcribeFinished ? "green.500" : "gray.200"}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text fontSize="xs" color="white" fontWeight="bold">
                      3
                    </Text>
                  </Box>
                  <Text
                    fontSize="xs"
                    color={transcribeFinished ? "green.600" : "gray.400"}
                    mt={1}
                    fontWeight={transcribeFinished ? "semibold" : "normal"}
                  >
                    Complete
                  </Text>
                </Flex>
              </Flex>

              {/* Upload progress with animated audio icon */}
              <Box w="full" maxW="md">
                {isUploading ? (
                  <VStack spacing={3} w="full">
                    {/* Progress bar with sliding audio icon */}
                    <Box w="full" position="relative" pt={8}>
                      {/* Sliding audio icon — clamped to max 96% so it doesn't overflow the bar edge */}
                      <Box
                        position="absolute"
                        top={0}
                        sx={{
                          left: `calc(${Math.min(percentComplete, 96)}% - 12px)`,
                          transition: "left 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                      >
                        <Box
                          bg="blue.500"
                          borderRadius="full"
                          w={6}
                          h={6}
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          boxShadow="0 2px 8px rgba(66,153,225,0.5)"
                          sx={{
                            animation: "audioIconPulse 1.5s ease-in-out infinite",
                            "@keyframes audioIconPulse": {
                              "0%, 100%": {
                                transform: "scale(1)",
                                boxShadow: "0 2px 8px rgba(66,153,225,0.5)",
                              },
                              "50%": {
                                transform: "scale(1.15)",
                                boxShadow: "0 4px 16px rgba(66,153,225,0.75)",
                              },
                            },
                          }}
                        >
                          <Icon as={MdAudiotrack} color="white" w={3.5} h={3.5} />
                        </Box>
                      </Box>
                      <Progress
                        w="full"
                        value={percentComplete}
                        size="sm"
                        colorScheme="blue"
                        borderRadius="full"
                        bg="gray.100"
                        sx={{
                          "& > div": {
                            transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                            backgroundImage: "linear-gradient(90deg, #4299e1, #805AD5)",
                          },
                        }}
                      />
                    </Box>
                    <Flex w="full" justifyContent="space-between" alignItems="center">
                      <Text fontSize="xs" color="gray.400">
                        {percentComplete > 0 ? "Uploading parts..." : "Preparing..."}
                      </Text>
                      <Text fontSize="sm" color="blue.600" fontWeight="semibold">
                        {percentComplete}%
                      </Text>
                    </Flex>
                  </VStack>
                ) : !uploadComplete || isRetryInProgress ? null : ( // Skip this case during retry in progress - handled above
                  <VStack spacing={3} w="full">
                    <Flex gap={3} alignItems="center" justifyContent="center">
                      <Spinner size="md" color="blue.500" thickness="3px" />
                    </Flex>
                    <Text fontSize="sm" color="gray.500" textAlign="center">
                      {transcribeFinished
                        ? "This may take a few minutes depending on the file size"
                        : "Generating your minutes..."}
                    </Text>
                  </VStack>
                )}
              </Box>

              {!transcribeFinished && (
                <Flex
                  bg="blue.50"
                  border="1px solid"
                  borderColor="blue.100"
                  borderRadius="lg"
                  px={4}
                  py={3}
                  w="full"
                  maxW="md"
                  alignItems="center"
                  gap={2}
                >
                  <Text fontSize="xs" color="blue.600" textAlign="center" w="full">
                    Please keep this tab open while we process your file.
                  </Text>
                </Flex>
              )}
            </VStack>
          </Box>
        )}
      </VStack>
    </Flex>
  );
}
