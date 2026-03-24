import React, { useState } from "react";
import { Box, Flex, Text, IconButton, useToast } from "@chakra-ui/react";
import { FiRefreshCw } from "react-icons/fi";
import Icon from "../Icon";
import RecordingsList from "@/components/recordings/RecordingsList";
import useRecordings from "@/hooks/useRecordings";
import { BOTTOM_BAR_HEIGHT_PX } from "../BottomBar";

export default function MobileRecordingsScreen() {
  const { refreshRecordings } = useRecordings();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const toast = useToast();

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

  return (
    <Flex direction="column" h="100%" w="100%" bg="white" overflow="hidden">
      <Flex
        flexShrink={0}
        bg="white"
        borderBottom="1px solid"
        borderColor="gray.100"
        px={4}
        py={2}
        alignItems="center"
        justifyContent="space-between"
        minH="48px"
      >
        <Flex alignItems="center" gap={2.5} minW={0} flex={1}>
          <Box w="20px" h="20px" flexShrink={0}>
            <Icon />
          </Box>
          <Text fontSize="md" fontWeight="medium" color="gray.700" isTruncated>
            Recordings
          </Text>
        </Flex>
        <IconButton
          aria-label="Refresh recordings"
          icon={<FiRefreshCw />}
          size="sm"
          variant="ghost"
          onClick={handleRefresh}
          isLoading={isRefreshing}
        />
      </Flex>

      <Flex flexDir="column" overflowY="auto" overflowX="hidden" flex={1} minH={0} w="100%">
        <RecordingsList />
      </Flex>
    </Flex>
  );
}
