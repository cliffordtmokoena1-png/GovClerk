import React, { useCallback, useState, useEffect, memo } from "react";
import {
  Box,
  IconButton,
  Flex,
  Text,
  Tooltip,
  useDisclosure,
  Skeleton,
  Divider,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useAuth } from "@clerk/nextjs";
import useSWR from "swr";
import Icon from "../Icon";
import RenameTranscriptModal from "../RenameTranscriptModal";
import MobileMinutesActionsDrawer from "./MobileMinutesActionsDrawer";
import { ApiSidebarResponse } from "@/pages/api/sidebar";
import { ApiGetCustomerDetailsResponse } from "@/pages/api/get-customer-details";
import { asUtcDate, humanReadableDuration, getFullDateString } from "@/utils/date";
import { ModalType } from "@/pages/dashboard/[[...slug]]";
import { useNavigationPerfAnalytics } from "../NavigationPerfAnalyticsProvider";
import { BOTTOM_BAR_HEIGHT_PX } from "../BottomBar";
import { useLongPress } from "@/hooks/useLongPress";
import { useOrgContext } from "@/contexts/OrgContext";

type SidebarItem = {
  title: string;
  transcriptId: number;
  dateCreated: Date;
  type: "minutes" | "agenda";
  seriesId?: string;
};

type ApiGetTokenResponse = {
  tokens: number;
};

type MobileHomeItemProps = {
  item: SidebarItem;
  selectedTranscript?: number | null;
  onItemClick: (item: SidebarItem) => void;
  onLongPress: (item: SidebarItem) => void;
};

const MobileHomeItem = memo(
  ({ item, selectedTranscript, onItemClick, onLongPress }: MobileHomeItemProps) => {
    const longPressHandlers = useLongPress(
      () => onLongPress(item),
      () => onItemClick(item),
      { delay: 500, preventDefault: false }
    );

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        longPressHandlers.onClick(e);
      },
      [longPressHandlers]
    );

    const handleTouchStart = useCallback(
      (e: React.TouchEvent) => {
        e.stopPropagation();
        longPressHandlers.onTouchStart(e);
      },
      [longPressHandlers]
    );

    const handleTouchEnd = useCallback(
      (e: React.TouchEvent) => {
        e.stopPropagation();
        longPressHandlers.onTouchEnd(e);
      },
      [longPressHandlers]
    );

    const handleTouchMove = useCallback(
      (e: React.TouchEvent) => {
        e.stopPropagation();
        longPressHandlers.onTouchMove(e);
      },
      [longPressHandlers]
    );

    return (
      <Flex
        key={item.transcriptId}
        px={4}
        py={3}
        userSelect="none"
        cursor="pointer"
        _active={{ bg: "gray.50" }}
        bg={item.transcriptId === selectedTranscript ? "blue.50" : "transparent"}
        position="relative"
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        flex={1}
        minW={0}
      >
        <Flex flexDirection="column" flex={1} minW={0}>
          <Tooltip
            label={item.title}
            isDisabled={!item.title || item.title.length <= 50}
            placement="top"
          >
            <Text
              fontSize="md"
              isTruncated
              whiteSpace="nowrap"
              fontWeight="semibold"
              textOverflow="ellipsis"
              color="gray.900"
              mb={1}
            >
              {item.title}
            </Text>
          </Tooltip>
          <Flex align="center" gap={1.5}>
            <Text
              fontSize="2xs"
              fontWeight="semibold"
              color={item.type === "agenda" ? "purple.600" : "blue.600"}
              bg={item.type === "agenda" ? "purple.50" : "blue.50"}
              px={1.5}
              py={0.5}
              borderRadius="sm"
              textTransform="uppercase"
              letterSpacing="wide"
            >
              {item.type === "agenda" ? "Agenda" : "Minutes"}
            </Text>
            <Text fontSize="xs" color="gray.400">
              •
            </Text>
            <Tooltip label={getFullDateString(item.dateCreated)} placement="top">
              <Text fontSize="sm" color="gray.500" suppressHydrationWarning>
                {(() => {
                  const timeText = humanReadableDuration(item.dateCreated);
                  return timeText.includes(",") ? timeText : `${timeText} ago`;
                })()}
              </Text>
            </Tooltip>
          </Flex>
        </Flex>
        <Text fontSize="lg" color="gray.400" flexShrink={0} ml={2}>
          ›
        </Text>
      </Flex>
    );
  }
);

MobileHomeItem.displayName = "MobileHomeItem";

type Props = {
  selectedTranscript?: number | null;
  initialSidebarItems?: ApiSidebarResponse | null;
  initialCustomerDetails?: ApiGetCustomerDetailsResponse | null;
  initialToken?: number | null;
  onOpen: (modalType: ModalType) => void;
  filePickerTrigger?: React.MutableRefObject<(() => void) | null>;
};

export default function MobileHomeScreen({
  selectedTranscript,
  initialSidebarItems,
  initialCustomerDetails,
  initialToken,
  onOpen,
  filePickerTrigger,
}: Props) {
  const router = useRouter();
  const { getToken } = useAuth();
  const { orgId } = useOrgContext();
  const { startNavMeasurement } = useNavigationPerfAnalytics();
  const { isOpen: isRenameOpen, onOpen: onRenameOpen, onClose: onRenameClose } = useDisclosure();
  const { isOpen: isActionsOpen, onOpen: onActionsOpen, onClose: onActionsClose } = useDisclosure();
  const [renameTranscriptId, setRenameTranscriptId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<SidebarItem | null>(null);

  const { data: sidebarRes, mutate } = useSWR(
    ["/api/sidebar", orgId],
    async (_) => {
      await getToken();
      return await fetch("/api/sidebar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orgId }),
      })
        .then((resp) => resp.json())
        .then((data: ApiSidebarResponse) => ({
          sidebarItems: data.sidebarItems.map((item) => ({
            title: item.title,
            transcriptId: item.transcriptId,
            dateCreated:
              typeof item.dateCreated === "string"
                ? asUtcDate(item.dateCreated)
                : new Date(item.dateCreated),
            type: item.type,
            seriesId: item.seriesId,
          })),
        }));
    },
    {
      revalidateOnMount: true,
      refreshWhenHidden: true,
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true,
      fallbackData: initialSidebarItems
        ? {
            sidebarItems: initialSidebarItems.sidebarItems.map((item) => ({
              title: item.title,
              transcriptId: item.transcriptId,
              dateCreated:
                typeof item.dateCreated === "string"
                  ? asUtcDate(item.dateCreated)
                  : new Date(item.dateCreated),
              type: item.type,
              seriesId: item.seriesId,
            })),
          }
        : undefined,
    }
  );

  useEffect(() => {
    if (sidebarRes?.sidebarItems) {
      const itemsToPrefetch = sidebarRes.sidebarItems.slice(0, 10);
      itemsToPrefetch.forEach((item) => {
        const path =
          item.type === "agenda"
            ? `/agendas/${item.transcriptId}`
            : `/dashboard/${item.transcriptId}`;
        router.prefetch(path);
      });
    }
  }, [router, sidebarRes]);

  const { data: customerDetails } = useSWR<ApiGetCustomerDetailsResponse>(
    ["/api/get-customer-details", orgId],
    async (_) => {
      await getToken();
      return await fetch("/api/get-customer-details", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orgId }),
      }).then((res) => res.json());
    },
    {
      revalidateOnMount: true,
      refreshWhenHidden: true,
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true,
      fallbackData: initialCustomerDetails || undefined,
    }
  );

  const { data: tokenData } = useSWR<ApiGetTokenResponse>(
    ["/api/get-tokens", orgId],
    async (_) => {
      await getToken();
      return await fetch("/api/get-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orgId }),
      }).then((res) => res.json());
    },
    {
      revalidateOnMount: true,
      refreshWhenHidden: true,
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true,
      fallbackData: initialToken != null ? { tokens: initialToken } : undefined,
    }
  );

  const handleItemClick = useCallback(
    (item: SidebarItem) => {
      const dest =
        item.type === "agenda"
          ? `/agendas/${item.transcriptId}`
          : `/dashboard/${item.transcriptId}`;
      startNavMeasurement({
        event: "nav_perf_sidebar_item",
        dest,
      });
      router.push(dest, undefined, { scroll: false });
    },
    [startNavMeasurement, router]
  );

  const handleLongPress = useCallback(
    (item: SidebarItem) => {
      setSelectedItem(item);
      onActionsOpen();
    },
    [onActionsOpen]
  );

  const handleRename = useCallback(() => {
    if (selectedItem) {
      setRenameTranscriptId(selectedItem.transcriptId);
      onRenameOpen();
    }
  }, [selectedItem, onRenameOpen]);

  const handleDelete = useCallback(async () => {
    if (selectedItem) {
      const res = await fetch("/api/delete-transcript", {
        method: "POST",
        body: JSON.stringify({ transcriptId: selectedItem.transcriptId }),
      });
      if (!res.ok) {
        return;
      }
      if (selectedTranscript === selectedItem.transcriptId) {
        router.push("/dashboard");
      }
      mutate();
    }
  }, [selectedItem, selectedTranscript, router, mutate]);

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
        <Flex alignItems="center" gap={2.5} minW={0}>
          <Box w="20px" h="20px" flexShrink={0}>
            <Icon />
          </Box>
          <Text fontSize="md" fontWeight="medium" color="gray.700" isTruncated>
            Agendas & Minutes
          </Text>
        </Flex>
      </Flex>

      <Flex
        flexDir="column"
        overflowY="auto"
        overflowX="hidden"
        flex={1}
        minH={0}
        w="100%"
        bg="white"
      >
        {sidebarRes == null ? (
          <Box>
            {[...Array(6)].map((_, i) => (
              <Box key={i}>
                <Box px={4} py={3}>
                  <Skeleton height="16px" width="75%" mb={2} />
                  <Skeleton height="12px" width="35%" />
                </Box>
                {i < 5 && <Divider />}
              </Box>
            ))}
          </Box>
        ) : !sidebarRes?.sidebarItems.length ? (
          <Flex
            flexDir="column"
            justifyContent="center"
            alignItems="center"
            w="full"
            h="full"
            px={6}
          >
            <Text fontSize="md" textAlign="center" color="gray.600" fontWeight="medium">
              No minutes yet
            </Text>
            <Text fontSize="sm" textAlign="center" color="gray.500" mt={1}>
              Tap + to create your first transcription
            </Text>
          </Flex>
        ) : (
          <Box pb={`${BOTTOM_BAR_HEIGHT_PX + 20}px`}>
            {sidebarRes.sidebarItems
              .sort((a, b) => (a.dateCreated > b.dateCreated ? -1 : 1))
              .map((item: SidebarItem, index: number) => (
                <React.Fragment key={item.transcriptId}>
                  <MobileHomeItem
                    item={item}
                    selectedTranscript={selectedTranscript}
                    onItemClick={handleItemClick}
                    onLongPress={handleLongPress}
                  />
                  {index < sidebarRes.sidebarItems.length - 1 && <Divider />}
                </React.Fragment>
              ))}
          </Box>
        )}
      </Flex>

      <MobileMinutesActionsDrawer
        isOpen={isActionsOpen}
        onClose={onActionsClose}
        minuteTitle={selectedItem?.title || ""}
        onRename={handleRename}
        onDelete={handleDelete}
      />

      {renameTranscriptId != null && (
        <RenameTranscriptModal
          isOpen={isRenameOpen}
          onClose={() => {
            onRenameClose();
            setRenameTranscriptId(null);
          }}
          onSuccess={() => {
            mutate();
          }}
          transcriptId={renameTranscriptId}
        />
      )}
    </Flex>
  );
}
