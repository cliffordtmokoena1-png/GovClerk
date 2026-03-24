import { Box, Flex, IconButton, Tooltip } from "@chakra-ui/react";
import { useRouter } from "next/router";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import PlusIcon from "./PlusIcon";
import Icon from "./Icon";
import { UserButton, useSession } from "@clerk/nextjs";
import { FiSettings, FiMic, FiCalendar, FiMenu, FiX, FiFileText } from "react-icons/fi";
import { BOTTOM_BAR_HEIGHT_PX } from "./BottomBar";
import { useAnnouncementBarHeight } from "./AnnouncementBar";

type MinibarProps = {
  toggleSidebar: () => void;
  isCollapsed: boolean;
  layoutKind: string;
};

const Minibar = ({ toggleSidebar, isCollapsed, layoutKind }: MinibarProps) => {
  const router = useRouter();
  const { session, isLoaded } = useSession();
  const announcementBarHeight = useAnnouncementBarHeight();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isAdmin = isLoaded && session?.user?.publicMetadata?.role === "admin";
  const isPastMeetings = layoutKind === "past-meetings";
  const minibarHeight = isPastMeetings
    ? `calc(100vh - ${BOTTOM_BAR_HEIGHT_PX}px - ${announcementBarHeight}px)`
    : `calc(100vh - ${announcementBarHeight}px)`;
  // To prevent SSR/client hydration mismatches, avoid using client-only localStorage-driven
  // isCollapsed during the initial paint. Assume false on SSR and first client render.
  const stableIsCollapsed = mounted ? isCollapsed : false;

  return (
    <Flex
      position="fixed"
      left={0}
      top={`${announcementBarHeight}px`}
      h={minibarHeight}
      w="60px"
      bg="#152a4e"
      borderRight="1px solid"
      borderRightColor="#1a3260"
      color="white"
      flexDirection="column"
      alignItems="center"
      justifyContent="space-between"
      py={4}
      px={2}
      zIndex={1}
      display={isPastMeetings ? "none" : "flex"}
    >
      <Flex direction="column" gap={2} alignItems="center" w={25}>
        <Link href="/dashboard">
          <Box mb={4}>
            <Icon />
          </Box>
        </Link>

        <Tooltip label="Minutes" placement="right">
          <IconButton
            aria-label="Minutes"
            icon={stableIsCollapsed ? <FiMenu /> : <FiX />}
            onClick={toggleSidebar}
            variant="ghost"
            size="md"
            color={stableIsCollapsed ? "whiteAlpha.600" : "white"}
            bg={stableIsCollapsed ? "transparent" : "whiteAlpha.200"}
            _hover={{ color: "white", bg: "whiteAlpha.200" }}
            suppressHydrationWarning
          />
        </Tooltip>

        <Tooltip label="Recordings" placement="right">
          <IconButton
            aria-label="Recordings"
            icon={<FiMic />}
            onClick={() => router.push("/recordings")}
            variant="ghost"
            size="md"
            color={router.pathname === "/recordings" ? "white" : "whiteAlpha.600"}
            bg={router.pathname === "/recordings" ? "whiteAlpha.200" : "transparent"}
            _hover={{ color: "white", bg: "whiteAlpha.200" }}
          />
        </Tooltip>

        <Tooltip label="Templates" placement="right">
          <IconButton
            aria-label="Templates"
            icon={<FiFileText />}
            onClick={() => router.push("/templates")}
            variant="ghost"
            size="md"
            color={router.pathname === "/templates" ? "white" : "whiteAlpha.600"}
            bg={router.pathname === "/templates" ? "whiteAlpha.200" : "transparent"}
            _hover={{ color: "white", bg: "whiteAlpha.200" }}
          />
        </Tooltip>

        <Tooltip label="Agendas" placement="right">
          <IconButton
            aria-label="Agendas"
            icon={<FiCalendar />}
            onClick={() => router.push("/agendas")}
            variant="ghost"
            size="md"
            color={router.pathname === "/agendas" ? "white" : "whiteAlpha.600"}
            bg={router.pathname === "/agendas" ? "whiteAlpha.200" : "transparent"}
            _hover={{ color: "white", bg: "whiteAlpha.200" }}
          />
        </Tooltip>

        {isAdmin && (
          <Tooltip label="Admin Panel" placement="right">
            <IconButton
              aria-label="Admin Panel"
              icon={<FiSettings />}
              onClick={() => router.push("/admin")}
              variant="ghost"
              size="md"
              color={router.pathname.startsWith("/admin") ? "white" : "whiteAlpha.600"}
              bg={router.pathname.startsWith("/admin") ? "whiteAlpha.200" : "transparent"}
              _hover={{ color: "white", bg: "whiteAlpha.200" }}
            />
          </Tooltip>
        )}

        {mounted && isCollapsed && router.pathname !== "/dashboard" && (
          <Tooltip label="New Upload" placement="right">
            <IconButton
              aria-label="New Upload"
              icon={<PlusIcon />}
              onClick={() => router.push("/dashboard")}
              variant="ghost"
              size="md"
              color="white"
              bg="whiteAlpha.200"
              _hover={{ color: "white", bg: "whiteAlpha.300" }}
            />
          </Tooltip>
        )}
      </Flex>
      <Box>
        <UserButton userProfileUrl="/profile" userProfileMode="navigation" />
      </Box>
    </Flex>
  );
};

export default Minibar;
