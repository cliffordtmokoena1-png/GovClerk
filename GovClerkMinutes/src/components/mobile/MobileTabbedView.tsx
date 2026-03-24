import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Flex,
  Text,
  Icon,
  IconButton,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  VStack,
  Skeleton,
  Spinner,
} from "@chakra-ui/react";
import { HiEllipsisVertical, HiArrowUpTray, HiChevronLeft } from "react-icons/hi2";
import { useRouter } from "next/router";
import {
  BOTTOM_BAR_HEIGHT,
  AUDIO_PLAYER_HEIGHT,
  AUDIO_PLAYER_BOTTOM_OFFSET,
} from "@/constants/layout";

type TabConfig = {
  label: string;
  content: React.ReactNode;
};

type Props = {
  transcriptId: number;
  transcriptTitle: string;
  tabs: TabConfig[];
  minutesContent?: React.ReactNode;
  minutesVersions?: number;
  selectedMinutesVersion?: number;
  onMinutesVersionChange?: (version: number) => void;
  isRegenerating?: boolean;
  uploadComplete?: boolean;
  transcribeFinished?: boolean;
  minutesReady?: boolean;
  onExport: () => void;
  onMoreActions: () => void;
  audioPlayer?: React.ReactNode;
  audioPlayerHeight?: number;
  contentType?: "Minutes" | "Agenda";
};

export default function MobileTabbedView({
  transcriptId,
  transcriptTitle,
  tabs,
  minutesContent,
  minutesVersions = 1,
  selectedMinutesVersion = 0,
  onMinutesVersionChange,
  isRegenerating = false,
  uploadComplete = true,
  transcribeFinished = true,
  minutesReady = true,
  onExport,
  onMoreActions,
  audioPlayer,
  audioPlayerHeight = AUDIO_PLAYER_HEIGHT,
  contentType = "Minutes",
}: Props) {
  const router = useRouter();
  const [tabIndex, setTabIndex] = useState(tabs.length > 1 ? 1 : 0);

  const handleBackClick = () => {
    router.push("/dashboard");
  };

  const minutesStartIndex = tabs.length;

  const isProcessing = uploadComplete && (!transcribeFinished || !minutesReady);
  const processingMessage = !transcribeFinished
    ? "Processing your upload..."
    : !minutesReady
      ? `Generating ${contentType.toLowerCase()}...`
      : "";

  const prevIsRegeneratingRef = useRef(isRegenerating);

  useEffect(() => {
    if (tabIndex >= minutesStartIndex && !isRegenerating) {
      const expectedTabIndex = minutesStartIndex + selectedMinutesVersion;
      if (tabIndex !== expectedTabIndex) {
        setTabIndex(expectedTabIndex);
      }
    }
  }, [selectedMinutesVersion, minutesStartIndex, tabIndex, isRegenerating]);

  useEffect(() => {
    const wasRegenerating = prevIsRegeneratingRef.current;
    const isNowRegenerating = isRegenerating;

    if (isNowRegenerating && !wasRegenerating) {
      const regeneratingTabIndex = minutesStartIndex + minutesVersions;
      setTabIndex(regeneratingTabIndex);
    } else if (!isNowRegenerating && wasRegenerating) {
      const latestMinutesTabIndex = minutesStartIndex + minutesVersions - 1;
      setTabIndex(latestMinutesTabIndex);

      if (onMinutesVersionChange) {
        onMinutesVersionChange(minutesVersions - 1);
      }
    }

    prevIsRegeneratingRef.current = isNowRegenerating;
  }, [isRegenerating, minutesVersions, minutesStartIndex, onMinutesVersionChange]);

  const handleTabChange = (index: number) => {
    setTabIndex(index);
    if (index >= minutesStartIndex && onMinutesVersionChange) {
      const versionIndex = index - minutesStartIndex;
      onMinutesVersionChange(versionIndex);
    }
  };

  const bottomPadding = audioPlayer ? `${AUDIO_PLAYER_BOTTOM_OFFSET + audioPlayerHeight}px` : "0";

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
          <IconButton
            aria-label="Back"
            icon={<HiChevronLeft />}
            size="sm"
            variant="ghost"
            onClick={handleBackClick}
            flexShrink={0}
          />
          <Text fontSize="md" fontWeight="medium" color="gray.700" isTruncated>
            {transcriptTitle}
          </Text>
        </Flex>
        <Flex gap={2} flexShrink={0} alignItems="center">
          <Flex
            as="button"
            alignItems="center"
            gap={1.5}
            px={3}
            py={1.5}
            bg="blue.500"
            color="white"
            borderRadius="md"
            fontSize="sm"
            fontWeight="medium"
            onClick={onExport}
            _active={{ bg: "blue.600" }}
            transition="all 0.2s ease"
          >
            <Icon as={HiArrowUpTray} boxSize={4} />
            <Text>Export</Text>
          </Flex>
          <IconButton
            aria-label="More actions"
            icon={<HiEllipsisVertical />}
            size="sm"
            variant="ghost"
            onClick={onMoreActions}
          />
        </Flex>
      </Flex>

      {isProcessing && (
        <Flex
          bg="blue.50"
          borderBottom="1px solid"
          borderColor="blue.100"
          px={4}
          py={2}
          alignItems="center"
          justifyContent="center"
          gap={2}
          flexShrink={0}
        >
          <Spinner size="xs" color="blue.500" />
          <Text fontSize="sm" color="blue.700" fontWeight="medium">
            {processingMessage}
          </Text>
        </Flex>
      )}

      <Tabs
        index={tabIndex}
        onChange={handleTabChange}
        variant="unstyled"
        display="flex"
        flexDirection="column"
        flex={1}
        minH={0}
        isLazy={false}
        lazyBehavior="keepMounted"
      >
        <TabList
          borderBottom="1px solid"
          borderColor="gray.200"
          bg="white"
          flexShrink={0}
          px={0}
          overflowX="auto"
          overflowY="hidden"
          css={{
            "&::-webkit-scrollbar": {
              display: "none",
            },
            scrollbarWidth: "none",
          }}
        >
          {tabs.map((tab, index) => (
            <Tab
              key={`tab-${index}`}
              fontSize="sm"
              fontWeight="medium"
              color="gray.600"
              _selected={{
                color: "blue.500",
                borderBottom: "2px solid",
                borderColor: "blue.500",
              }}
              py={3}
              flexShrink={0}
            >
              {tab.label}
            </Tab>
          ))}

          {Array.from({ length: minutesVersions }, (_, i) => (
            <Tab
              key={`minutes-v${i + 1}`}
              fontSize="sm"
              fontWeight="medium"
              color="gray.600"
              _selected={{
                color: "blue.500",
                borderBottom: "2px solid",
                borderColor: "blue.500",
              }}
              py={3}
              flexShrink={0}
            >
              {contentType} {minutesVersions > 1 ? `v${i + 1}` : ""}
            </Tab>
          ))}

          {isRegenerating && (
            <Tab
              fontSize="sm"
              fontWeight="medium"
              color="gray.600"
              _selected={{
                color: "blue.500",
                borderBottom: "2px solid",
                borderColor: "blue.500",
              }}
              py={3}
              flexShrink={0}
            >
              Regenerating...
            </Tab>
          )}
        </TabList>

        <TabPanels flex={1} minH={0} display="flex" flexDirection="column">
          {tabs.map((tab, index) => (
            <TabPanel
              key={`panel-${index}`}
              p={0}
              flex={1}
              minH={0}
              display="flex"
              flexDirection="column"
              h="full"
            >
              <Box flex={1} minH={0} overflowY="auto" h="full" w="full" pb={bottomPadding}>
                {tab.content}
              </Box>
            </TabPanel>
          ))}

          {minutesContent &&
            Array.from({ length: minutesVersions }, (_, i) => (
              <TabPanel
                key={`minutes-panel-v${i + 1}`}
                p={0}
                flex={1}
                minH={0}
                display="flex"
                flexDirection="column"
                h="full"
              >
                <Flex flex={1} minH={0} h="full" w="full" direction="column" pb={bottomPadding}>
                  {minutesContent}
                </Flex>
              </TabPanel>
            ))}

          {isRegenerating && (
            <TabPanel p={0} flex={1} minH={0} display="flex" flexDirection="column" h="full">
              <Box
                flex={1}
                minH={0}
                overflowY="auto"
                h="full"
                w="full"
                pb={bottomPadding}
                px={8}
                py={8}
              >
                <VStack align="stretch" spacing={6}>
                  <Flex
                    display="flex"
                    alignItems="center"
                    gap={2}
                    borderRadius="md"
                    px={4}
                    py={3}
                    bg="blue.50"
                    borderColor="blue.200"
                    borderWidth="1px"
                  >
                    <Spinner color="blue.500" size="sm" thickness="2px" flexShrink={0} />
                    <Text
                      as="span"
                      fontSize="sm"
                      fontWeight="medium"
                      color="blue.700"
                      lineHeight="normal"
                    >
                      Regenerating your {contentType.toLowerCase()}...
                    </Text>
                  </Flex>

                  {/* Section 1 - Title/Heading */}
                  <VStack align="stretch" spacing={3}>
                    <Skeleton height="32px" width="70%" borderRadius="md" />
                    <Skeleton height="18px" width="95%" borderRadius="md" />
                    <Skeleton height="18px" width="92%" borderRadius="md" />
                    <Skeleton height="18px" width="88%" borderRadius="md" />
                  </VStack>

                  {/* Section 2 */}
                  <VStack align="stretch" spacing={3}>
                    <Skeleton height="28px" width="55%" borderRadius="md" />
                    <Skeleton height="18px" width="90%" borderRadius="md" />
                    <Skeleton height="18px" width="94%" borderRadius="md" />
                    <Skeleton height="18px" width="85%" borderRadius="md" />
                    <Skeleton height="18px" width="91%" borderRadius="md" />
                  </VStack>

                  {/* Section 3 */}
                  <VStack align="stretch" spacing={3}>
                    <Skeleton height="28px" width="60%" borderRadius="md" />
                    <Skeleton height="18px" width="88%" borderRadius="md" />
                    <Skeleton height="18px" width="93%" borderRadius="md" />
                    <Skeleton height="18px" width="89%" borderRadius="md" />
                  </VStack>
                </VStack>
              </Box>
            </TabPanel>
          )}
        </TabPanels>
      </Tabs>

      {audioPlayer && (
        <Box
          position="fixed"
          bottom={`${BOTTOM_BAR_HEIGHT + AUDIO_PLAYER_BOTTOM_OFFSET}px`}
          left={0}
          right={0}
          h={`${audioPlayerHeight}px`}
          bg="white"
          borderTop="1px solid"
          borderColor="gray.200"
          zIndex={5}
          boxShadow="0 -2px 10px rgba(0, 0, 0, 0.05)"
        >
          {audioPlayer}
        </Box>
      )}
    </Flex>
  );
}
