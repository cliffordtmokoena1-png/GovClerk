import React, { useState } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  Badge,
  VStack,
  HStack,
  IconButton,
  Spinner,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
  useBreakpointValue,
} from "@chakra-ui/react";
import { FiDownload, FiTrash2, FiClock, FiCalendar, FiAlertCircle } from "react-icons/fi";
import { RecordingWithBlob } from "@/hooks/useRecordings";
import useRecordings from "@/hooks/useRecordings";
import { getRecordingStateColor, getRecordingStateText } from "@/utils/recording";
import { formatBytes, formatDuration, formatDateTime } from "@/utils/format";

type RecordingItemProps = {
  recording: RecordingWithBlob;
};

export default function RecordingItem({ recording }: RecordingItemProps) {
  const { downloadRecording, deleteRecording } = useRecordings();
  const [isDeleting, setIsDeleting] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const toast = useToast();
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;

  const handleDownload = () => {
    if (recording.blob) {
      downloadRecording(recording.sessionId);
      toast({
        title: "Download started",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteRecording(recording.sessionId);
      toast({
        title: "Recording deleted",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
      onClose();
    } catch (error) {
      toast({
        title: "Failed to delete recording",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const canDownload = !recording.isCompiling && recording.blob && !recording.error;

  return (
    <>
      <Box p={isMobile ? 4 : 4} bg="white" _active={{ bg: "gray.50" }} transition="background 0.2s">
        <Flex direction="column" gap={isMobile ? 2 : 4}>
          <VStack align="start" spacing={isMobile ? 1.5 : 2} flex={1}>
            <HStack
              spacing={1}
              fontSize={isMobile ? "sm" : "md"}
              fontWeight="medium"
              color="gray.900"
            >
              <FiCalendar size={isMobile ? 14 : 16} />
              <Text>{formatDateTime(recording.startTime)}</Text>
            </HStack>

            <HStack spacing={2} flexWrap="wrap" fontSize="xs">
              <Badge colorScheme={getRecordingStateColor(recording.state)} fontSize="xs">
                {getRecordingStateText(recording.state)}
              </Badge>
              {recording.isCompiling && (
                <Badge colorScheme="blue" fontSize="xs">
                  Compiling...
                </Badge>
              )}
              {recording.error && (
                <Badge colorScheme="red" fontSize="xs">
                  Error
                </Badge>
              )}
              <HStack spacing={1} color="gray.600">
                <FiClock size={12} />
                <Text>{formatDuration(recording.accumulatedDuration)}</Text>
              </HStack>
              {recording.blob && <Text color="gray.600">{formatBytes(recording.blob.size)}</Text>}
            </HStack>

            {recording.error && (
              <HStack spacing={1} color="red.500" fontSize="xs">
                <FiAlertCircle size={12} />
                <Text>{recording.error}</Text>
              </HStack>
            )}

            {!isMobile && (
              <Text fontSize="xs" color="gray.500">
                {recording.chunkCount} chunk{recording.chunkCount !== 1 ? "s" : ""} •{" "}
                {recording.mimeType}
              </Text>
            )}
          </VStack>

          <Flex gap={2} align="stretch">
            {recording.isCompiling ? (
              <Button size="sm" isDisabled leftIcon={<Spinner size="xs" />} flex={1}>
                Compiling...
              </Button>
            ) : (
              <Button
                size="sm"
                leftIcon={<FiDownload />}
                colorScheme="blue"
                isDisabled={!canDownload}
                onClick={handleDownload}
                flex={1}
              >
                Download
              </Button>
            )}

            <IconButton
              size="sm"
              icon={<FiTrash2 />}
              aria-label="Delete recording"
              variant="outline"
              colorScheme="red"
              onClick={onOpen}
              isDisabled={isDeleting}
            />
          </Flex>
        </Flex>
      </Box>

      <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef as any} onClose={onClose}>
        <AlertDialogOverlay>
          <AlertDialogContent mx={4}>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Recording
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete this recording? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDelete} ml={3} isLoading={isDeleting}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
