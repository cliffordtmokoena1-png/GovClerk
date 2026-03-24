import Minibar from "./Minibar";
import { ApiSidebarResponse } from "@/pages/api/sidebar";
import { asUtcDate } from "@/utils/date";
import {
  Box,
  Button,
  Flex,
  Text,
  Divider,
  Tooltip,
  useDisclosure,
  Skeleton,
  SkeletonText,
} from "@chakra-ui/react";
import AccountPanel from "./AccountPanel";
import useSWR from "swr";
import PlusIcon from "./PlusIcon";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState, memo, useCallback } from "react";
import { LayoutKind, ModalType } from "@/pages/dashboard/[[...slug]]";
import { ApiGetCustomerDetailsResponse } from "@/pages/api/get-customer-details";
import SidebarEllipses from "./SidebarEllipses";
import { useRouter } from "next/router";
import { useNavigationPerfAnalytics } from "./NavigationPerfAnalyticsProvider";
import RenameTranscriptModal from "./RenameTranscriptModal";
import { useOrgContext } from "@/contexts/OrgContext";

type ApiGetTokenResponse = {
  tokens: number | null;
};

export type SidebarItem = {
  title: string;
  transcriptId: number;
  dateCreated: Date;
  type: "minutes" | "agenda";
  seriesId?: string;
};

const SIDEBAR_MAX_W = 300;
export const SIDEBAR_MAX_W_PX = `${SIDEBAR_MAX_W}px`;
const TITLE_MAX_W_PX = `${SIDEBAR_MAX_W - 50}px`;

function humanReadableDuration(date: Date | string | number | null | undefined): string {
  if (!date) {
    return "Recently";
  }

  let dateObj: Date;
  if (typeof date === "string" && date.includes("-") && date.includes(":")) {
    dateObj = new Date(date.replace(" ", "T") + "Z");
  } else if (date instanceof Date) {
    dateObj = new Date(date.getTime());
  } else {
    dateObj = new Date(date);
  }

  if (isNaN(dateObj.getTime())) {
    return "Recently";
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
  const minutes = Math.floor(diffInSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 6) {
    try {
      // Try to use the browser's locale, this is undefined because when you pass undefined as the parameter, js uses the default local settings
      return dateObj.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return dateObj.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  }
  if (days === 1) {
    return `${days} day`;
  }
  if (days > 0) {
    return `${days} days`;
  }
  if (hours === 1) {
    return `${hours} hour`;
  }
  if (hours > 0) {
    return `${hours} hours`;
  }
  if (minutes === 1) {
    return `${minutes} min`;
  }
  if (minutes > 0) {
    return `${minutes} mins`;
  }
  return "1 min";
}

function getFullDateString(date: Date | string | number | null | undefined): string {
  if (!date) {
    return "Unknown date";
  }

  let dateObj: Date;
  if (typeof date === "string" && date.includes("-") && date.includes(":")) {
    dateObj = new Date(date.replace(" ", "T") + "Z");
  } else if (date instanceof Date) {
    dateObj = new Date(date.getTime());
  } else {
    dateObj = new Date(date);
  }

  if (isNaN(dateObj.getTime())) {
    return "Unknown date";
  }

  return (
    dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }) +
    " at " +
    dateObj.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  );
}

type Props = {
  selectedTranscript?: number | null;
  onOpen: (modalType: ModalType) => void;
  layoutKind: LayoutKind;
  initialSidebarItems?: ApiSidebarResponse | null;
  initialCustomerDetails?: ApiGetCustomerDetailsResponse | null;
  initialToken?: number | null;
  toggleSidebar: () => void;
  isCollapsed: boolean;
  filePickerTrigger?: React.MutableRefObject<(() => void) | null>;
};

type SidebarItemComponentProps = {
  item: SidebarItem;
  selectedTranscript?: number | null;
  layoutKind: LayoutKind;
  onItemClick: (item: SidebarItem) => void;
  onDelete: () => void;
  onRename: (id: number) => void;
};

const SidebarItemComponent = memo(
  ({
    item,
    selectedTranscript,
    layoutKind,
    onItemClick,
    onDelete,
    onRename,
  }: SidebarItemComponentProps) => {
    return (
      <Flex
        key={item.transcriptId}
        role="group"
        py={3}
        px={3}
        userSelect="none"
        cursor="pointer"
        borderLeft="3px solid"
        borderLeftColor={item.transcriptId === selectedTranscript ? "blue.700" : "transparent"}
        borderRadius="sm"
        transition="all 0.15s"
        _hover={{
          bg: "gray.100",
          borderLeftColor: item.transcriptId === selectedTranscript ? "blue.700" : "gray.300",
        }}
        bg={item.transcriptId === selectedTranscript ? "gray.100" : "transparent"}
        justifyContent="space-between"
        position="relative"
        onClick={() => onItemClick(item)}
      >
        <Flex flexDirection="column" flex={1} minW={0}>
          <Tooltip
            label={item.title}
            isDisabled={!item.title || item.title.length <= 30}
            placement="top"
          >
            <Text
              fontSize="sm"
              isTruncated
              whiteSpace="nowrap"
              fontWeight="semibold"
              maxW={layoutKind === "past-meetings" ? "85vw" : TITLE_MAX_W_PX}
              textOverflow="ellipsis"
              color="gray.900"
              mb={1.5}
            >
              {item.title}
            </Text>
          </Tooltip>
          <Flex align="center" gap={1.5}>
            <Text
              fontSize="2xs"
              fontWeight="semibold"
              color={item.type === "agenda" ? "gray.100" : "gray.100"}
              bg={item.type === "agenda" ? "gray.600" : "blue.800"}
              px={1.5}
              py={0.5}
              borderRadius="sm"
              textTransform="uppercase"
              letterSpacing="wide"
              flexShrink={0}
            >
              {item.type === "agenda" ? "Agenda" : "Minutes"}
            </Text>
            <Text fontSize="xs" color="gray.400" flexShrink={0}>
              •
            </Text>
            <Tooltip label={getFullDateString(item.dateCreated)} placement="top">
              <Text fontSize="xs" color="gray.500" suppressHydrationWarning isTruncated>
                {(() => {
                  const timeText = humanReadableDuration(item.dateCreated);
                  return timeText.includes(",") ? timeText : `${timeText} ago`;
                })()}
              </Text>
            </Tooltip>
          </Flex>
        </Flex>
        <Flex
          visibility={layoutKind === "past-meetings" ? "visible" : "hidden"}
          _groupHover={{ visibility: "visible" }}
          alignItems="center"
          position="absolute"
          right={0}
          top={0}
          bottom={0}
        >
          <SidebarEllipses
            pageTranscriptId={selectedTranscript}
            itemTranscriptId={item.transcriptId}
            bgColor={item.transcriptId === selectedTranscript ? "gray.100" : "gray.50"}
            onDelete={onDelete}
            onRename={onRename}
          />
        </Flex>
      </Flex>
    );
  }
);

SidebarItemComponent.displayName = "SidebarItemComponent";

const Sidebar = ({
  toggleSidebar,
  isCollapsed,
  selectedTranscript,
  onOpen,
  layoutKind,
  initialSidebarItems,
  initialCustomerDetails,
  initialToken,
  filePickerTrigger,
}: Props) => {
  const router = useRouter();
  const { userId, getToken } = useAuth();
  const { orgId } = useOrgContext();
  const { startNavMeasurement } = useNavigationPerfAnalytics();
  const { isOpen: isRenameOpen, onOpen: onRenameOpen, onClose: onRenameClose } = useDisclosure();
  const [renameTranscriptId, setRenameTranscriptId] = useState<number | null>(null);

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

  const handleOpenRename = useCallback(
    (id: number) => {
      setRenameTranscriptId(id);
      onRenameOpen();
    },
    [onRenameOpen]
  );

  let { data: sidebarRes, mutate } = useSWR(
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
        .then((data: ApiSidebarResponse) => {
          return {
            sidebarItems: data.sidebarItems.map((item) => {
              const dateCreated =
                typeof item.dateCreated === "string"
                  ? asUtcDate(item.dateCreated)
                  : new Date(item.dateCreated);
              return {
                title: item.title,
                transcriptId: item.transcriptId,
                dateCreated,
                type: item.type,
                seriesId: item.seriesId,
              };
            }),
          };
        });
    },
    {
      revalidateOnMount: true,
      refreshWhenHidden: true,
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      keepPreviousData: true,
    }
  );

  sidebarRes =
    sidebarRes ||
    (initialSidebarItems != null
      ? {
          sidebarItems: initialSidebarItems.sidebarItems.map((item) => {
            const dateCreated =
              typeof item.dateCreated === "string"
                ? asUtcDate(item.dateCreated)
                : new Date(item.dateCreated);
            return {
              title: item.title,
              transcriptId: item.transcriptId,
              dateCreated,
              type: item.type,
              seriesId: item.seriesId,
            };
          }),
        }
      : undefined);

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

  let { data: customerDetails } = useSWR<ApiGetCustomerDetailsResponse>(
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
    }
  );

  customerDetails = customerDetails || initialCustomerDetails || undefined;

  useEffect(() => {
    mutate();
  }, [mutate, selectedTranscript]);

  let { data: tokenData } = useSWR<ApiGetTokenResponse>(
    ["/api/get-tokens", userId, orgId],
    async (_) => {
      await getToken();
      return await fetch("/api/get-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, orgId }),
      }).then((res) => res.json());
    },
    {
      revalidateOnMount: true,
      refreshWhenHidden: true,
      revalidateOnFocus: true,
      refreshInterval: 30000,
    }
  );

  tokenData = tokenData || (initialToken != null ? { tokens: initialToken } : undefined);

  // Prevent SSR/client hydration mismatches: assume not-collapsed until after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const stableIsCollapsed = mounted ? isCollapsed : false;

  const hasInsufficientTokens = tokenData?.tokens != null && tokenData.tokens <= 0;

  return (
    <Flex direction="row" h="100%">
      <Minibar toggleSidebar={toggleSidebar} isCollapsed={isCollapsed} layoutKind={layoutKind} />
      <Flex
        flexDir="column"
        overflowX="hidden"
        h="100%"
        ml={layoutKind === "past-meetings" ? "0" : "60px"}
        w={layoutKind === "past-meetings" ? "100%" : stableIsCollapsed ? "0px" : SIDEBAR_MAX_W_PX}
        transition="margin-left 0.3s ease, width 0.3s ease"
        borderRight="1px solid"
        borderRightColor="gray.200"
        bg="gray.50"
      >
        {layoutKind !== "past-meetings" && (
          <Box position="sticky" top="0" zIndex="10" bg="gray.50">
            <Flex
              flexDirection="column"
              justifyContent="center"
              alignItems="flex-start"
              bgColor="gray.50"
              gap={3}
              mb={3}
              px={4}
              pt={4}
              pb={3}
            >
              <Text
                fontSize="md"
                fontWeight="bold"
                color="gray.700"
                whiteSpace="nowrap"
                isTruncated
              >
                Agendas & Minutes
              </Text>
              <Tooltip
                isDisabled={!hasInsufficientTokens}
                label="You need tokens to upload. Please upgrade your plan."
                placement="bottom"
                hasArrow
              >
                <Button
                  colorScheme="blue"
                  bg={hasInsufficientTokens ? "gray.400" : "#152a4e"}
                  color="white"
                  size="sm"
                  w="full"
                  isDisabled={hasInsufficientTokens}
                  cursor={hasInsufficientTokens ? "not-allowed" : "pointer"}
                  onClick={() => {
                    if (hasInsufficientTokens) {
                      return;
                    }
                    // If we have a file picker trigger (meaning we're on dashboard), use it
                    if (filePickerTrigger?.current) {
                      filePickerTrigger.current();
                    } else {
                      router.push("/dashboard");
                    }
                  }}
                  leftIcon={<PlusIcon />}
                  borderRadius="lg"
                  fontWeight="semibold"
                  _hover={
                    hasInsufficientTokens
                      ? {}
                      : { bg: "#1a3260", transform: "translateY(-1px)", shadow: "sm" }
                  }
                  transition="all 0.2s"
                >
                  New Upload
                </Button>
              </Tooltip>
            </Flex>
            <Divider />
          </Box>
        )}
        <Flex flexDir="column" overflowY="auto" overflowX="hidden" flex={1} minH={0} p={4}>
          {sidebarRes == null ? (
            <Flex flexDir="column" gap={3} w="full">
              {[...Array(5)].map((_, i) => (
                <Box key={i} p={3} borderRadius="md">
                  <Skeleton height="16px" width="70%" mb={2} />
                  <Skeleton height="12px" width="40%" />
                </Box>
              ))}
            </Flex>
          ) : !sidebarRes?.sidebarItems.length ? (
            <Flex flexDir="column" justifyContent="center" alignItems="center" w="full" h="full">
              <Text fontSize="xl" textAlign="center">
                No minutes here yet!
              </Text>
            </Flex>
          ) : (
            sidebarRes.sidebarItems
              .sort((a, b) => {
                return a.dateCreated > b.dateCreated ? -1 : 1;
              })
              .map((item: SidebarItem) => (
                <SidebarItemComponent
                  key={item.transcriptId}
                  item={item}
                  selectedTranscript={selectedTranscript}
                  layoutKind={layoutKind}
                  onItemClick={handleItemClick}
                  onDelete={mutate}
                  onRename={handleOpenRename}
                />
              ))
          )}
        </Flex>
        <Box flexShrink={0}>
          <AccountPanel
            layoutKind={layoutKind}
            customerDetails={customerDetails}
            tokenData={tokenData}
            onOpen={onOpen}
          />
        </Box>
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
    </Flex>
  );
};

export default Sidebar;
