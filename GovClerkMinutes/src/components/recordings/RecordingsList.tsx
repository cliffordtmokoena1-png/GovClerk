import React, { useState } from "react";
import {
  Box,
  VStack,
  Text,
  Spinner,
  Alert,
  AlertIcon,
  Button,
  Flex,
  useToast,
  Badge,
  HStack,
  useBreakpointValue,
  Divider,
} from "@chakra-ui/react";
import { FiRefreshCw, FiDownload, FiTrash2 } from "react-icons/fi";
import useRecordings from "@/hooks/useRecordings";
import RecordingItem from "./RecordingItem";
import { formatBytes } from "@/utils/format";
import { BOTTOM_BAR_HEIGHT_PX } from "../BottomBar";

export default function RecordingsList() {
  const { recordings, isLoading, error, refreshRecordings, getTotalSize } = useRecordings();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const toast = useToast();
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshRecordings();
      toast({
        title: "Recordings refreshed",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Failed to refresh recordings",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const totalSize = getTotalSize();
  const completedRecordings = recordings.filter((r) => !r.isCompiling && r.blob);

  if (isLoading) {
    return (
      <Box textAlign="center" py={8}>
        <Spinner size="lg" color="blue.500" />
        <Text mt={4} color="gray.600">
          Loading recordings...
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        <Box>
          <Text fontWeight="bold">Error loading recordings</Text>
          <Text>{error}</Text>
        </Box>
      </Alert>
    );
  }

  if (recordings.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <Text fontSize="lg" color="gray.600" mb={4}>
          No recordings found
        </Text>
        <Text color="gray.500" mb={6}>
          Start recording audio to see your recordings here.
        </Text>
        <Button
          leftIcon={<FiRefreshCw />}
          onClick={handleRefresh}
          isLoading={isRefreshing}
          variant="outline"
        >
          Refresh
        </Button>
      </Box>
    );
  }

  return (
    <Box w="100%">
      {!isMobile && (
        <Flex
          justify="space-between"
          align="center"
          p={4}
          bg="gray.50"
          borderRadius="md"
          flexDirection={{ base: "column", sm: "row" }}
          gap={{ base: 3, sm: 0 }}
        >
          <HStack spacing={4} flexWrap="wrap">
            <Badge colorScheme="blue" fontSize="sm" px={2} py={1}>
              {recordings.length} recording{recordings.length !== 1 ? "s" : ""}
            </Badge>
            <Badge colorScheme="green" fontSize="sm" px={2} py={1}>
              {completedRecordings.length} ready
            </Badge>
            {totalSize > 0 && (
              <Badge colorScheme="purple" fontSize="sm" px={2} py={1}>
                {formatBytes(totalSize)}
              </Badge>
            )}
          </HStack>
          <Button
            leftIcon={<FiRefreshCw />}
            onClick={handleRefresh}
            isLoading={isRefreshing}
            size="sm"
            variant="outline"
          >
            Refresh
          </Button>
        </Flex>
      )}

      {isMobile && recordings.length > 0 && (
        <Flex gap={2} flexWrap="wrap" px={4} pt={3} pb={2}>
          <Badge colorScheme="blue" fontSize="xs" px={2} py={1}>
            {recordings.length} total
          </Badge>
          <Badge colorScheme="green" fontSize="xs" px={2} py={1}>
            {completedRecordings.length} ready
          </Badge>
          {totalSize > 0 && (
            <Badge colorScheme="purple" fontSize="xs" px={2} py={1}>
              {formatBytes(totalSize)}
            </Badge>
          )}
        </Flex>
      )}

      {/* Recordings list with dividers */}
      <Box pb={isMobile ? `${BOTTOM_BAR_HEIGHT_PX + 20}px` : 4}>
        {recordings.map((recording, index) => (
          <React.Fragment key={recording.sessionId}>
            <RecordingItem recording={recording} />
            {index < recordings.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
}
