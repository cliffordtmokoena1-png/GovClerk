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
  ButtonGroup,
  Button,
} from "@chakra-ui/react";
import { HiEllipsisVertical, HiArrowUpTray, HiChevronLeft } from "react-icons/hi2";
import { FiRefreshCw } from "react-icons/fi";
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

type ViewMode = "transcript" | "both" | "minutes";

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
  onRetrieve?: () => void;
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
  onRetrieve,
  audioPlayer,
  audioPlayerHeight = AUDIO_PLAYER_HEIGHT,
  contentType = "Minutes",
}: Props) {
  const router = useRouter();
  const [tabIndex, setTabIndex] = useState(tabs.length > 1 ? 1 : 0);
  const [viewMode, setViewMode] = useState<ViewMode>("both");

  const handleBackClick = () => {
    router.push("/dashboard");
  };

  const isProcessing = uploadComplete && (!transcribeFinished || !minutesReady);
  const processingMessage = !transcribeFinished
    ? "Processing your upload..."
    : !minutesReady
      ? `Generating ${contentType.toLowerCase()}...`
      : "";

  const prevIsRegeneratingRef = useRef(isRegenerating);

  useEffect(() => {
    const wasRegenerating = prevIsRegeneratingRef.current;
    const isNowRegenerating = isRegenerating;

    if (!isNowRegenerating && wasRegenerating) {
      if (onMinutesVersionChange) {
        onMinutesVersionChange(minutesVersions - 1);
      }
    }

    prevIsRegeneratingRef.current = isNowRegenerating;
  }, [isRegenerating, minutesVersions, onMinutesVersionChange]);

  const handleTabChange = (index: number) => {
    setTabIndex(index);
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
          {onRetrieve && (
            <IconButton
              aria-label="Retrieve"
              icon={<FiRefreshCw />}
              size="sm"
              variant="ghost"
              onClick={onRetrieve}
            />
          )}
          <Flex
            as="button"
            alignItems="center"
            gap={1.5}
            px={3}
            py={1.5}
            bg="#1a365d"
            color="white"
            borderRadius="md"
            fontSize="sm"
            fontWeight="medium"
            onClick={onExport}
            _active={{ bg: "#1e3a5f" }}
            transition="all 0.2s ease"
          >
            <Icon as={HiArrowUpTray} boxSize={4} />
            <Text>Retrieve File</Text>
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

      <Flex
        flexShrink={0}
        px={4}
        py={2}
        bg="white"
        borderBottom="1px solid"
        borderColor="gray.100"
        justifyContent="center"
      >
        <ButtonGroup isAttached size="sm">
          {(["transcript", "both", "minutes"] as ViewMode[]).map((mode) => {
            const labels: Record<ViewMode, string> = {
              transcript: "Transcript",
              both: "Both",
              minutes: contentType,
            };
            const isActive = viewMode === mode;
            return (
              <Button
                key={mode}
                bg={isActive ? "#1a365d" : "white"}
                color={isActive ? "white" : "gray.600"}
                borderColor="gray.300"
                borderWidth="1px"
                _hover={{ bg: isActive ? "#1e3a5f" : "gray.50" }}
                onClick={() => setViewMode(mode)}
              >
                {labels[mode]}
              </Button>
            );
          })}
        </ButtonGroup>
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

      <Flex flex={1} minH={0} direction="column" overflow="hidden">
        {(viewMode === "transcript" || viewMode === "both") && (
          <Tabs
            index={tabIndex}
            onChange={handleTabChange}
            variant="unstyled"
            display="flex"
            flexDirection="column"
            flex={viewMode === "both" ? 1 : undefined}
            h={viewMode === "transcript" ? "full" : undefined}
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
                    color: "#1a365d",
                    borderBottom: "2px solid",
                    borderColor: "#1a365d",
                  }}
                  py={3}
                  flexShrink={0}
                >
                  {tab.label}
                </Tab>
              ))}
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
                  <Box
                    flex={1}
                    minH={0}
                    overflowY="auto"
                    h="full"
                    w="full"
                    pb={viewMode === "transcript" ? bottomPadding : "0"}
                  >
                    {tab.content}
                  </Box>
                </TabPanel>
              ))}
            </TabPanels>
          </Tabs>
        )}

        {(viewMode === "minutes" || viewMode === "both") && minutesContent && (
          <Flex
            flex={1}
            minH={0}
            h={viewMode === "minutes" ? "full" : undefined}
            w="full"
            direction="column"
            overflowY="auto"
            pb={bottomPadding}
            borderTop={viewMode === "both" ? "1px solid" : undefined}
            borderColor={viewMode === "both" ? "gray.200" : undefined}
          >
            {minutesContent}
          </Flex>
        )}

        {(viewMode === "minutes" || viewMode === "both") && isRegenerating && (
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

              <VStack align="stretch" spacing={3}>
                <Skeleton height="32px" width="70%" borderRadius="md" />
                <Skeleton height="18px" width="95%" borderRadius="md" />
                <Skeleton height="18px" width="92%" borderRadius="md" />
                <Skeleton height="18px" width="88%" borderRadius="md" />
              </VStack>

              <VStack align="stretch" spacing={3}>
                <Skeleton height="28px" width="55%" borderRadius="md" />
                <Skeleton height="18px" width="90%" borderRadius="md" />
                <Skeleton height="18px" width="94%" borderRadius="md" />
                <Skeleton height="18px" width="85%" borderRadius="md" />
                <Skeleton height="18px" width="91%" borderRadius="md" />
              </VStack>

              <VStack align="stretch" spacing={3}>
                <Skeleton height="28px" width="60%" borderRadius="md" />
                <Skeleton height="18px" width="88%" borderRadius="md" />
                <Skeleton height="18px" width="93%" borderRadius="md" />
                <Skeleton height="18px" width="89%" borderRadius="md" />
              </VStack>
            </VStack>
          </Box>
        )}
      </Flex>

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
