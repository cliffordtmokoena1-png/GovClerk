import { Box, Flex, Text, IconButton, Input, Button, Spinner, useToast } from "@chakra-ui/react";
import { useState, useRef, useContext, useEffect } from "react";
import useUploadProgress from "@/hooks/useUploadProgress";
import { FiEdit2, FiThumbsDown, FiThumbsUp } from "react-icons/fi";

import { safeCapture } from "@/utils/safePosthog";
import { ApiLabelSpeakerResponseResult1 } from "@/pages/api/label-speaker";
import useSWR, { useSWRConfig } from "swr";
import { ApiSidebarResponse } from "@/pages/api/sidebar";
import { ApiGetMinutesResponseResult } from "./Minutes";
import { UploadUriContext } from "./UploadUriProvider";
import { MdOutlineOpenInNew } from "react-icons/md";
import { UploadData } from "./TextTranscriptController";
import ExportButton from "./ExportButton";
import { useOrgContext } from "@/contexts/OrgContext";

export const TOP_BAR_HEIGHT_PX = 56;

type Props = {
  transcriptId?: number;
  transcribeFinished?: boolean;
  uploadComplete?: boolean;
  data?: ApiLabelSpeakerResponseResult1;
  transcript?: UploadData;
  minutes?: string;
  minutesStatus?: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE" | "PREVIEW_COMPLETED";
  showProgress: boolean;
  selectedTabIndex?: number;
  getMinutesData?: ApiGetMinutesResponseResult;
};

export default function ProductTopBar({
  transcriptId,
  transcribeFinished,
  uploadComplete,
  data,
  transcript,
  minutes,
  minutesStatus,
  showProgress,
  selectedTabIndex,
  getMinutesData,
}: Props) {
  const { chunksUploaded, totalChunks } = useUploadProgress(transcriptId);
  const isProcessing = !transcribeFinished;
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutate: globalMutate } = useSWRConfig();
  const { uploadUriMap, updateUploadUri } = useContext(UploadUriContext);
  const toast = useToast();
  const { orgId } = useOrgContext();

  const minutesData = getMinutesData;

  const { data: sidebarRes, mutate } = useSWR<ApiSidebarResponse>(
    transcriptId ? ["/api/sidebar", orgId] : null,
    async ([uri, _orgId]) => {
      return await fetch(uri, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orgId: _orgId }),
      }).then((resp) => resp.json());
    },
    {
      revalidateOnMount: true,
      refreshWhenHidden: true,
    }
  );

  const currentTranscript = sidebarRes?.sidebarItems?.find(
    (item) => item.transcriptId === transcriptId
  );

  const handleStartEdit = () => {
    setEditedTitle(currentTranscript?.title || "Untitled Transcript");
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const handleSaveTitle = async () => {
    if (!transcriptId) {
      return;
    }

    try {
      await fetch("/api/rename-transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcriptId,
          title: editedTitle,
        }),
      });
      mutate();

      if (uploadUriMap[transcriptId]) {
        updateUploadUri(transcriptId, {
          ...uploadUriMap[transcriptId],
          filename: editedTitle,
        });
      }
    } catch (error) {
      console.error("Failed to rename transcript:", error);
    }
    setIsEditing(false);
  };

  const getMinutesContent = (overrideVersionIndex?: number) => {
    if (!minutesData) {
      return "";
    }

    let minutesContent = "";

    // Get the most up-to-date tab index
    let currentTabIndex;
    if (overrideVersionIndex !== undefined) {
      currentTabIndex = overrideVersionIndex;
    } else if (minutesData.selectedTabIndex !== undefined) {
      currentTabIndex = minutesData.selectedTabIndex;
    } else if (currentTabIndexRef.current !== undefined) {
      currentTabIndex = currentTabIndexRef.current;
    } else {
      currentTabIndex = selectedTabIndex;
    }

    if (minutesData.minutes?.length) {
      let versionIndex;
      if (currentTabIndex !== undefined) {
        versionIndex = currentTabIndex;
      } else {
        versionIndex = minutesData.minutes.length - 1;
      }

      if (versionIndex >= 0 && versionIndex < minutesData.minutes.length) {
        minutesContent = minutesData.minutes[versionIndex] || "";
      } else {
        minutesContent = minutesData.minutes[minutesData.minutes.length - 1] || "";
      }
    }

    // Replace speaker placeholders with actual speaker names
    if (data?.labelsToSpeaker && minutesContent) {
      const labels = Object.keys(data.labelsToSpeaker);
      labels.forEach((label) => {
        const placeholder = `{{${label}}}`;
        const speakerName = data.labelsToSpeaker?.[label]?.name;
        if (speakerName) {
          minutesContent = minutesContent.split(placeholder).join(speakerName);
        }
      });
    }

    return minutesContent.replace(/{{([^}]+)}}/g, (match, p1) => p1);
  };

  const getStatusText = () => {
    if (!uploadComplete) {
      return `Uploading (${Math.floor((100.0 * chunksUploaded) / totalChunks)}%)...`;
    }

    if (!transcribeFinished) {
      return "Transcribing... ";
    }

    return null;
  };

  const currentTabIndexRef = useRef<number | undefined>(selectedTabIndex);

  useEffect(() => {
    if (selectedTabIndex !== undefined) {
      currentTabIndexRef.current = selectedTabIndex;
    }
  }, [selectedTabIndex]);

  return (
    <Box top={0} zIndex={100} bg="white" w="full">
      <Flex
        px={{ base: 2, md: 4 }}
        h={`${TOP_BAR_HEIGHT_PX}px`}
        alignItems="center"
        justifyContent="space-between"
      >
        <Flex
          alignItems="center"
          gap={1}
          position="relative"
          role="group"
          flex={{ base: 1, md: "auto" }}
          justifyContent="flex-start"
        >
          {isEditing ? (
            <Input
              ref={inputRef}
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveTitle();
                }
                if (e.key === "Escape") {
                  setIsEditing(false);
                }
              }}
              size="sm"
              width="auto"
              minW={{ base: "150px", md: "200px" }}
              textAlign="center"
            />
          ) : (
            <>
              <Text
                fontSize={{ base: "sm", md: "md" }}
                fontWeight="medium"
                color="gray.700"
                isTruncated
                maxW={{ base: "150px", md: "300px" }}
              >
                {currentTranscript?.title || "Untitled Transcript"}
              </Text>
              <IconButton
                aria-label="Edit title"
                icon={<FiEdit2 size={10} />}
                variant="ghost"
                size="xs"
                onClick={handleStartEdit}
                opacity={1}
              />
            </>
          )}
          {showProgress &&
            (() => {
              const statusText = getStatusText();
              return (
                statusText && (
                  <>
                    <Text fontSize="xs" color="gray.400" display={{ base: "none", md: "block" }}>
                      -
                    </Text>
                    <Flex alignItems="center" gap={1}>
                      <Text fontSize="xs" color="gray.500" display={{ base: "none", md: "block" }}>
                        {statusText}
                      </Text>
                      <Spinner size="xs" color="gray.500" />
                    </Flex>
                  </>
                )
              );
            })()}
        </Flex>
        <Flex flex={{ base: 0, md: "auto" }} justifyContent="flex-end" alignItems="center" gap={4}>
          <Flex alignItems="center" gap={2}>
            {(minutes || minutesData?.minutes) &&
              (minutesStatus === "COMPLETE" || minutesData?.status === "COMPLETE") && (
                <Flex alignItems="center" gap={2}>
                  <Text
                    display={{ base: "none", md: "block" }}
                    fontSize="sm"
                    color="gray.600"
                    fontWeight="medium"
                  >
                    Rate your minutes
                  </Text>
                  <Flex gap={2}>
                    <IconButton
                      aria-label="Rate thumbs up"
                      icon={<FiThumbsUp size={18} />}
                      variant="ghost"
                      size="sm"
                      colorScheme={minutesData?.rating === "up" ? "green" : "blue"}
                      _hover={{ bg: "blue.50" }}
                      onClick={() => {
                        if (!transcriptId) {
                          return;
                        }
                        safeCapture("minutes_thumbs_up", {
                          transcript_id: transcriptId,
                        });
                        globalMutate(
                          ["/api/update-minutes"],
                          fetch("/api/update-minutes", {
                            method: "POST",
                            body: JSON.stringify({
                              transcriptId,
                              rating: "up",
                              msWordClick: false,
                              copyClick: false,
                            }),
                          })
                            .then((res) => res.json())
                            .then((data) => {
                              if (data.hasReviewed) {
                                return;
                              }
                              toast({
                                title: <Text fontSize="2xl">Can you help us?</Text>,
                                variant: "left-accent",
                                description: (
                                  <Flex flexDir="column" gap={2} pt={4}>
                                    <Text>Studies show 90% of people read reviews.</Text>
                                    <Text>
                                      It would mean{" "}
                                      <Text as="span" fontWeight="extrabold">
                                        so much
                                      </Text>{" "}
                                      if you wrote us one.
                                    </Text>
                                    <Text>
                                      You&apos;ll help more admins escape the pain of writing
                                      minutes.
                                    </Text>
                                    <Button
                                      as="a"
                                      href="https://www.trustpilot.com/evaluate/GovClerkMinutes.com"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      colorScheme="orange"
                                      size="md"
                                      mt={1}
                                      onClick={() => {
                                        toast.closeAll();
                                        safeCapture("trustpilot_review_clicked", {
                                          transcript_id: transcriptId,
                                        });
                                        fetch("/api/mark-reviewed", {
                                          method: "POST",
                                          body: JSON.stringify({
                                            transcriptId,
                                          }),
                                        });
                                      }}
                                    >
                                      Leave a review &nbsp; <MdOutlineOpenInNew />
                                    </Button>
                                  </Flex>
                                ),
                                duration: null,
                                isClosable: true,
                                position: "top",
                              });
                            })
                        ).then(() => {
                          globalMutate(["/api/get-minutes", transcriptId]);
                        });
                      }}
                    />
                    <IconButton
                      aria-label="Rate thumbs down"
                      icon={<FiThumbsDown size={18} />}
                      variant="ghost"
                      size="sm"
                      colorScheme={minutesData?.rating === "down" ? "red" : "blue"}
                      _hover={{ bg: "blue.50" }}
                      onClick={() => {
                        if (!transcriptId) {
                          return;
                        }
                        safeCapture("minutes_thumbs_down", {
                          transcript_id: transcriptId,
                        });
                        globalMutate(
                          ["/api/update-minutes"],
                          fetch("/api/update-minutes", {
                            method: "POST",
                            body: JSON.stringify({
                              transcriptId,
                              rating: "down",
                              msWordClick: false,
                              copyClick: false,
                            }),
                          }).then((res) => res.json())
                        ).then(() => {
                          globalMutate(["/api/get-minutes", transcriptId]);
                        });
                      }}
                    />
                  </Flex>
                </Flex>
              )}
          </Flex>
          <ExportButton
            transcriptId={transcriptId}
            data={data}
            transcript={transcript}
            isProcessing={isProcessing}
            uploadUriMap={uploadUriMap}
            getMinutesContent={getMinutesContent}
            minutesData={minutesData}
            selectedTabIndex={selectedTabIndex}
          />
        </Flex>
      </Flex>
    </Box>
  );
}
