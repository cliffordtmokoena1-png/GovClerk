import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  Flex,
  VStack,
  Spinner,
  Text,
  Box,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useBreakpointValue,
  Button,
  Icon,
  Heading,
  Link,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { MdErrorOutline, MdDashboard, MdRefresh } from "react-icons/md";
import AgendaSourceController from "./AgendaSourceController";
import MarkdownMinutes from "../MarkdownMinutes";
import { safeCapture } from "@/utils/safePosthog";
import { useExportHandlers } from "@/hooks/useExportHandlers";
import { useRegenerateAgenda } from "@/hooks/useRegenerateAgenda";
import AgendaTopBar from "./AgendaTopBar";
import MobileAgendaView from "./MobileAgendaView";
import MobileExportDrawer from "../mobile/MobileExportDrawer";
import MobileTranscriptActionsDrawer from "../mobile/MobileTranscriptActionsDrawer";
import RenameTranscriptModal from "../RenameTranscriptModal";
import useSWR from "swr";
import { Minute, MinutesState, createMinutesState } from "@/types/MinutesState";
import { AgendaDetail } from "@/types/agenda";
import { openWhatsAppChat } from "@/utils/whatsapp";

type Props = Readonly<{
  agendaId?: number | null;
}>;

export default function AgendaPage({ agendaId }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [agenda, setAgenda] = useState<AgendaDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDesktop = useBreakpointValue({ base: false, md: true });
  const firstLoadRef = useRef(true);

  const [isExportDrawerOpen, setIsExportDrawerOpen] = useState(false);
  const [isActionsDrawerOpen, setIsActionsDrawerOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);

  const [minutesManager, setMinutesManager] = useState<MinutesState>(
    createMinutesState([], "NOT_STARTED", false)
  );

  const tabContentCache = useRef<Record<number, string>>({});

  useEffect(() => {
    if (!agendaId) {
      setIsLoading(false);
      return;
    }

    const fetchAgenda = async () => {
      try {
        const response = await fetch(`/api/agendas/by-id/${agendaId}`);
        if (response.ok) {
          const data: AgendaDetail = await response.json();
          setAgenda(data);
        } else {
          toast({
            title: "Failed to load agenda",
            status: "error",
            duration: 3000,
          });
        }
      } catch (error) {
        console.error("Failed to fetch agenda:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgenda();
  }, [agendaId, toast]);

  const { data: agendaWithVersions, mutate: mutateAgenda } = useSWR<AgendaDetail>(
    agenda?.seriesId ? ["/api/agendas/by-series", agenda.seriesId] : null,
    async ([_, seriesId]) => {
      const response = await fetch(`/api/agendas/by-series/${seriesId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch agenda versions");
      }
      return response.json();
    },
    {
      refreshInterval: (data) => (data?.versions?.some((v) => v.status === "pending") ? 2000 : 0),
    }
  );

  const { regenerateAgenda, isRegenerating } = useRegenerateAgenda({
    seriesId: agenda?.seriesId || "",
    setMinutesManager,
    onSuccess: () => {
      mutateAgenda();
    },
  });

  useEffect(() => {
    if (!agendaWithVersions) {
      return;
    }

    const completedVersions = agendaWithVersions.versions
      .filter((v) => v.status === "generated" && v.content)
      .map((v) => ({
        text: v.content!,
        isStreaming: false,
      }));

    const hasPendingVersion = agendaWithVersions.versions.some((v) => v.status === "pending");

    setMinutesManager((prev) => {
      let newTabIndex = prev.selectedTabIndex;

      if (firstLoadRef.current && completedVersions.length > 0) {
        newTabIndex = completedVersions.length - 1;
        firstLoadRef.current = false;
      }

      const isStreaming = hasPendingVersion;
      const status = completedVersions.length > 0 ? "INITIAL_MINUTE_COMPLETED" : "NOT_STARTED";

      return {
        ...prev,
        minutes: completedVersions as Minute[],
        selectedTabIndex: newTabIndex,
        isStreaming,
        status,
        dbStatus: agendaWithVersions.status === "generated" ? "COMPLETE" : "IN_PROGRESS",
      };
    });
  }, [agendaWithVersions]);

  const saveAgenda = useCallback(
    async (content: string, versionIndex: number) => {
      if (!agendaWithVersions) {
        return;
      }

      const version = agendaWithVersions.versions[versionIndex];
      if (!version) {
        return;
      }

      try {
        setIsSaving(true);
        const response = await fetch(`/api/agendas/${version.id}/save`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });

        if (!response.ok) {
          throw new Error("Failed to save agenda");
        }

        setLastSaved(new Date());
        safeCapture("agenda_saved", {
          agenda_id: version.id,
          series_id: agendaWithVersions.seriesId,
          version: versionIndex + 1,
        });
      } catch (error) {
        console.error("Error saving agenda:", error);
        toast({
          title: "Failed to save agenda",
          status: "error",
          duration: 3000,
        });
      } finally {
        setIsSaving(false);
      }
    },
    [agendaWithVersions, toast]
  );

  const handleSaveAgenda = useCallback(
    (content: string, versionIndex: number) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      setIsSaving(true);
      saveTimeoutRef.current = setTimeout(() => {
        saveAgenda(content, versionIndex);
      }, 3000);
    },
    [saveAgenda]
  );

  const handleMinutesChange = useCallback((content: string) => {
    setMinutesManager((prev) => {
      const selectedIndex = prev.selectedTabIndex;
      const cacheKey = selectedIndex;

      if (tabContentCache.current[cacheKey] === content) {
        return prev;
      }

      tabContentCache.current[cacheKey] = content;

      const newMinutes = [...prev.minutes];

      if (selectedIndex >= 0 && selectedIndex < newMinutes.length) {
        newMinutes[selectedIndex] = { text: content, isStreaming: false };
      }

      return {
        ...prev,
        minutes: newMinutes,
      };
    });
  }, []);

  const getAgendaContent = useCallback(
    (versionIndex?: number) => {
      const targetIndex = versionIndex ?? minutesManager.selectedTabIndex;
      const selectedMinute = minutesManager.minutes[targetIndex];
      return selectedMinute?.text || "";
    },
    [minutesManager]
  );

  const { handleExportMinutes, isExporting } = useExportHandlers({
    transcriptId: agendaWithVersions?.id,
    title: agendaWithVersions?.title || "Untitled",
    getMinutesContent: getAgendaContent,
    contentType: "Agenda",
  });

  const handleExportDocx = useCallback(
    (versionIndex?: number) => {
      const targetContent = getAgendaContent(versionIndex);
      if (targetContent && agendaWithVersions) {
        handleExportMinutes("docx");
        fetch(`/api/agendas/${agendaWithVersions.id}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format: "docx" }),
        }).catch((error) => {
          console.error("Failed to log export:", error);
        });
        safeCapture("agenda_exported", {
          agenda_id: agendaWithVersions.id,
          series_id: agendaWithVersions.seriesId,
          format: "docx",
          version: (versionIndex ?? minutesManager.selectedTabIndex) + 1,
        });
      }
    },
    [agendaWithVersions, handleExportMinutes, getAgendaContent, minutesManager]
  );

  const handleExportPdf = useCallback(
    (versionIndex?: number) => {
      const targetContent = getAgendaContent(versionIndex);
      if (targetContent && agendaWithVersions) {
        handleExportMinutes("pdf");
        fetch(`/api/agendas/${agendaWithVersions.id}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format: "pdf" }),
        }).catch((error) => {
          console.error("Failed to log export:", error);
        });
        safeCapture("agenda_exported", {
          agenda_id: agendaWithVersions.id,
          series_id: agendaWithVersions.seriesId,
          format: "pdf",
          version: (versionIndex ?? minutesManager.selectedTabIndex) + 1,
        });
      }
    },
    [agendaWithVersions, handleExportMinutes, getAgendaContent, minutesManager]
  );

  const handleCopy = async (versionIndex?: number) => {
    const targetIndex = versionIndex ?? minutesManager.selectedTabIndex;
    const targetContent = minutesManager.minutes[targetIndex]?.text || "";

    try {
      await navigator.clipboard.writeText(targetContent);

      if (agendaWithVersions) {
        fetch(`/api/agendas/${agendaWithVersions.id}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format: "copy" }),
        }).catch((error) => {
          console.error("Failed to log export:", error);
        });
        safeCapture("agenda_exported", {
          agenda_id: agendaWithVersions.id,
          series_id: agendaWithVersions.seriesId,
          format: "copy",
          version: targetIndex + 1,
        });
      }

      toast({
        title: "Copied to clipboard",
        description: "Agenda copied successfully",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Copy failed:", error);
      toast({
        title: "Copy failed",
        description: "Failed to copy agenda to clipboard",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleTitleUpdate = useCallback(
    async (newTitle: string) => {
      if (!agendaWithVersions) {
        return;
      }

      try {
        const response = await fetch(`/api/agendas/${agendaWithVersions.id}/update-title`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        });

        if (!response.ok) {
          throw new Error("Failed to update title");
        }

        mutateAgenda();
        toast({
          title: "Title updated",
          status: "success",
          duration: 2000,
        });
      } catch (error) {
        console.error("Error updating title:", error);
        toast({
          title: "Failed to update title",
          status: "error",
          duration: 3000,
        });
      }
    },
    [agendaWithVersions, mutateAgenda, toast]
  );

  // Early returns AFTER all hooks
  if (!agendaId || isLoading) {
    return (
      <Flex w="full" h="full" flex="1" alignItems="center" justifyContent="center">
        <VStack spacing={4}>
          <Spinner size="lg" color="blue.500" thickness="3px" />
          <Text color="gray.600" fontSize="md">
            {agendaId ? "Loading agenda..." : "No agenda selected"}
          </Text>
        </VStack>
      </Flex>
    );
  }

  if (!agenda) {
    return (
      <Flex w="full" h="full" flex="1" alignItems="center" justifyContent="center">
        <VStack spacing={4}>
          <Text fontSize="xl" fontWeight="semibold" color="gray.700">
            Agenda not found
          </Text>
          <Text color="gray.500" fontSize="sm">
            This agenda may have been deleted or you don&apos;t have access to it.
          </Text>
        </VStack>
      </Flex>
    );
  }

  if (agenda.status === "failed") {
    return (
      <Flex
        w="full"
        h="full"
        flex="1"
        alignItems="center"
        justifyContent="center"
        bg="white"
        px={4}
      >
        <Box w="full" py={8}>
          <VStack spacing={8} align="center">
            <Icon as={MdErrorOutline} w={20} h={20} color="red.500" opacity={0.9} />

            <VStack spacing={2}>
              <Heading size="lg" color="gray.700" fontWeight="semibold">
                Generation Failed
              </Heading>
              <Text color="gray.500" fontSize="md" textAlign="center" maxW="md">
                Something went wrong while generating your agenda. Please try again.
              </Text>

              <Text fontSize="xs" color="gray.400" textAlign="center" mt={2} maxW="sm">
                No tokens were applied for this failed generation.
                <br />
                If you need help,{" "}
                <Link
                  color="blue.500"
                  onClick={() => {
                    openWhatsAppChat(
                      "Hi, I need help with a failed agenda generation. Can you assist?",
                      "agenda_page"
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
              <Button
                size="md"
                colorScheme="blue"
                onClick={() => router.push("/agendas")}
                px={8}
                borderRadius="full"
                boxShadow="sm"
                _hover={{ boxShadow: "md" }}
                width="full"
                maxW="xs"
                leftIcon={<Icon as={MdRefresh} />}
              >
                Create New Agenda
              </Button>

              <Button
                size="md"
                colorScheme="gray"
                onClick={() => router.push("/dashboard")}
                px={8}
                borderRadius="full"
                boxShadow="sm"
                _hover={{ boxShadow: "md" }}
                variant="outline"
                width="full"
                maxW="xs"
                leftIcon={<Icon as={MdDashboard} />}
              >
                Return to Dashboard
              </Button>
            </Flex>
          </VStack>
        </Box>
      </Flex>
    );
  }

  const hasAgendaContent = minutesManager.minutes.length > 0;
  const latestVersion = agendaWithVersions?.version || 1;
  const isLatest = minutesManager.selectedTabIndex === minutesManager.minutes.length - 1;

  return (
    <Flex direction="column" h="100%" w="100%">
      {isDesktop && (
        <AgendaTopBar
          agendaId={agendaWithVersions?.id || agenda.id}
          title={agendaWithVersions?.title || agenda.title}
          status={agendaWithVersions?.status || agenda.status}
          lastSaved={lastSaved}
          isSaving={isSaving}
          onTitleUpdate={handleTitleUpdate}
          onCopy={handleCopy}
          onExportDocx={handleExportDocx}
          onExportPdf={handleExportPdf}
          isExporting={isExporting}
          canExport={hasAgendaContent && minutesManager.dbStatus === "COMPLETE"}
          versions={agendaWithVersions?.versions}
          selectedVersion={minutesManager.selectedTabIndex}
        />
      )}

      <Flex direction="row" flex={1} overflow="hidden">
        <Box
          w={{ base: "0", md: "50%" }}
          minW={{ base: "0", md: "400px" }}
          h="100%"
          display={{ base: "none", md: "block" }}
        >
          <AgendaSourceController
            sourceText={agendaWithVersions?.sourceText || agenda.sourceText}
            title={agendaWithVersions?.title || agenda.title}
          />
        </Box>

        {isDesktop ? (
          <Flex direction="column" flex={1} h="100%">
            {hasAgendaContent ? (
              <Tabs
                variant="enclosed"
                h="full"
                size="md"
                display="flex"
                flexDirection="column"
                index={minutesManager.selectedTabIndex}
                onChange={(index) => {
                  setMinutesManager((prev) => ({
                    ...prev,
                    selectedTabIndex: index,
                  }));
                }}
              >
                <Box
                  position="sticky"
                  top={0}
                  zIndex={200}
                  bgColor="white"
                  borderBottomColor="gray.200"
                  borderBottom="1px solid"
                >
                  <TabList borderBottomColor="gray.200">
                    {minutesManager.minutes.map((minute, index) => (
                      <Tab
                        key={`version-${index}-${minute.text.slice(0, 10)}`}
                        isDisabled={minutesManager.isAnimating}
                      >
                        Version {index + 1}
                      </Tab>
                    ))}
                    {minutesManager.isStreaming && (
                      <Tab isDisabled={minutesManager.isAnimating}>
                        Version {minutesManager.minutes.length + 1}
                      </Tab>
                    )}
                  </TabList>
                </Box>
                <Box
                  flex="1"
                  minH="0"
                  overflowY="auto"
                  bgColor="white"
                  border="1px solid"
                  borderColor="gray.200"
                  borderTop="none"
                >
                  <TabPanels h="full">
                    {minutesManager.minutes.map((minute, index) => (
                      <TabPanel key={`panel-${index}-${minute.text.slice(0, 10)}`} p={0}>
                        <MarkdownMinutes
                          minutes={minute.text}
                          transcriptId={agendaWithVersions?.id || agenda.id}
                          speakerData={undefined}
                          onSave={(content) => handleSaveAgenda(content, index)}
                          onMinutesChange={handleMinutesChange}
                          lastSaved={lastSaved}
                          isSaving={isSaving}
                          version={index + 1}
                          isLatest={index === minutesManager.minutes.length - 1}
                          isPreview={false}
                          isUpdating={
                            minutesManager.isStreaming && index === minutesManager.minutes.length
                          }
                          canRegenerate={
                            latestVersion < 3 && index === minutesManager.minutes.length - 1
                          }
                          setMinutesManager={setMinutesManager}
                          customRegenerateFunction={regenerateAgenda}
                          customIsRegenerating={isRegenerating}
                          contentType="Agenda"
                        />
                      </TabPanel>
                    ))}
                    {minutesManager.isStreaming && (
                      <TabPanel p={0}>
                        <MarkdownMinutes
                          minutes=""
                          transcriptId={agendaWithVersions?.id || agenda.id}
                          speakerData={undefined}
                          onSave={(content) =>
                            handleSaveAgenda(content, minutesManager.minutes.length)
                          }
                          onMinutesChange={handleMinutesChange}
                          lastSaved={lastSaved}
                          isSaving={isSaving}
                          version={minutesManager.minutes.length + 1}
                          isLatest
                          isPreview={false}
                          isUpdating
                          canRegenerate={latestVersion < 3}
                          setMinutesManager={setMinutesManager}
                          customRegenerateFunction={regenerateAgenda}
                          customIsRegenerating={isRegenerating}
                          contentType="Agenda"
                        />
                      </TabPanel>
                    )}
                  </TabPanels>
                </Box>
              </Tabs>
            ) : (
              <Flex flex={1} h="100%" align="center" justify="center" py={12}>
                <VStack spacing={4}>
                  <Spinner size="lg" color="blue.500" />
                  <Text fontSize="md" color="gray.600" textAlign="center">
                    Generating your agenda...
                  </Text>
                </VStack>
              </Flex>
            )}
          </Flex>
        ) : (
          <Flex direction="column" flex={1} h="100%">
            <MobileAgendaView
              agendaId={agendaWithVersions?.id || agenda.id}
              agendaTitle={agendaWithVersions?.title || agenda.title || "Untitled Agenda"}
              sourceContent={
                <AgendaSourceController
                  sourceText={agendaWithVersions?.sourceText || agenda.sourceText}
                  title={agendaWithVersions?.title || agenda.title}
                />
              }
              agendaContent={
                hasAgendaContent ? (
                  <MarkdownMinutes
                    minutes={minutesManager.minutes[minutesManager.selectedTabIndex]?.text || ""}
                    transcriptId={agendaWithVersions?.id || agenda.id}
                    speakerData={undefined}
                    onSave={(content) => handleSaveAgenda(content, minutesManager.selectedTabIndex)}
                    onMinutesChange={handleMinutesChange}
                    lastSaved={lastSaved}
                    isSaving={isSaving}
                    version={minutesManager.selectedTabIndex + 1}
                    isLatest={isLatest}
                    isPreview={false}
                    isUpdating={minutesManager.isStreaming}
                    canRegenerate={latestVersion < 3 && isLatest}
                    setMinutesManager={setMinutesManager}
                    customRegenerateFunction={regenerateAgenda}
                    customIsRegenerating={isRegenerating}
                    contentType="Agenda"
                    inMobileTabbedView
                  />
                ) : (
                  <Flex flex={1} h="100%" align="center" justify="center" py={12}>
                    <VStack spacing={4}>
                      <Spinner size="lg" color="blue.500" />
                      <Text fontSize="md" color="gray.600" textAlign="center">
                        Generating your agenda...
                      </Text>
                    </VStack>
                  </Flex>
                )
              }
              agendaVersions={minutesManager.minutes.length}
              selectedAgendaVersion={minutesManager.selectedTabIndex}
              onAgendaVersionChange={(version) => {
                setMinutesManager((prev) => ({
                  ...prev,
                  selectedTabIndex: version,
                }));
              }}
              isRegenerating={isRegenerating}
              agendaReady={hasAgendaContent}
              onExport={() => setIsExportDrawerOpen(true)}
              onMoreActions={() => setIsActionsDrawerOpen(true)}
            />
            <MobileExportDrawer
              isOpen={isExportDrawerOpen}
              onClose={() => setIsExportDrawerOpen(false)}
              onCopyMinutes={() => void handleCopy()}
              onCopyTranscript={() => {}}
              onExportMinutesDocx={() => handleExportDocx()}
              onExportMinutesPdf={() => handleExportPdf()}
              onExportTranscriptDocx={() => {}}
              onExportTranscriptPdf={() => {}}
              hideTranscript
              minutesData={{
                status: hasAgendaContent ? "COMPLETE" : "IN_PROGRESS",
                minutes: minutesManager.minutes.map((m) => m.text),
              }}
              selectedVersion={minutesManager.selectedTabIndex}
              onVersionChange={(version) => {
                setMinutesManager((prev) => ({
                  ...prev,
                  selectedTabIndex: version,
                }));
              }}
              contentType="Agenda"
            />
            <MobileTranscriptActionsDrawer
              isOpen={isActionsDrawerOpen}
              onClose={() => setIsActionsDrawerOpen(false)}
              transcriptId={agendaWithVersions?.id || agenda.id}
              onRename={() => {
                setIsActionsDrawerOpen(false);
                setIsRenameModalOpen(true);
              }}
            />
            <RenameTranscriptModal
              isOpen={isRenameModalOpen}
              onClose={() => setIsRenameModalOpen(false)}
              onSuccess={() => {
                setIsRenameModalOpen(false);
                mutateAgenda();
              }}
              transcriptId={agendaWithVersions?.id || agenda.id}
            />
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}
