import { Text, Flex } from "@chakra-ui/react";
import MultiStepProgress from "./MultiStepProgress";
import useUploadProgress from "@/hooks/useUploadProgress";

type Props = {
  transcriptId?: number;
  transcribeFinished: boolean;
  diarizationReady: boolean;
  uploadComplete: boolean;
  nonNullTranscriptCount?: number;
  totalTranscriptCount?: number;
  duration?: number;
};
export default function ProgressIndicator({
  transcriptId,
  transcribeFinished,
  diarizationReady,
  uploadComplete,
  nonNullTranscriptCount,
  totalTranscriptCount,
  duration,
}: Props) {
  const { chunksUploaded, totalChunks, uploadProgressError } = useUploadProgress(transcriptId);
  return (
    <Flex
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      w="full"
      gap={4}
      py={4}
    >
      <Flex alignItems="center" justifyContent="center" w={["full", "3xl"]} maxW="full">
        <MultiStepProgress
          currentStep={(() => {
            if (transcribeFinished) {
              return 4;
            }
            if (diarizationReady) {
              return 3;
            }
            if (uploadComplete) {
              return 2;
            }
            return 1;
          })()}
          nonNullTranscriptCount={nonNullTranscriptCount}
          totalTranscriptCount={totalTranscriptCount}
          uploadPct={(1.0 * chunksUploaded) / totalChunks}
        />
      </Flex>
      {(() => {
        if (diarizationReady && nonNullTranscriptCount != null && totalTranscriptCount != null) {
          return (
            <Text fontSize="md">
              Segments transcribed: &nbsp; {nonNullTranscriptCount} of {totalTranscriptCount} &nbsp;
              ({Math.round((100 * nonNullTranscriptCount) / totalTranscriptCount)}
              %)
            </Text>
          );
        } else if (!uploadComplete) {
          return (
            <Text fontSize="md">
              Upload progress: &nbsp; {Math.floor((100.0 * chunksUploaded) / totalChunks)}%
            </Text>
          );
        } else {
          return (
            <Text fontSize="md">
              Estimated completion time:{" "}
              {duration ? Math.max(2, 4 * Math.floor(duration / 3600)) : 4} minutes
            </Text>
          );
        }
      })()}
    </Flex>
  );
}
