import React from "react";
import { Box, Flex } from "@chakra-ui/react";
import { useAuth } from "@clerk/nextjs";
import MgHead from "@/components/MgHead";
import DesktopLayout from "@/components/layouts/DesktopLayout";
import DesktopTemplatesScreen from "@/components/desktop/DesktopTemplatesScreen";
import MobileTemplatesScreen from "@/components/mobile/MobileTemplatesScreen";
import AnnouncementBar, { useAnnouncementBarHeight } from "@/components/AnnouncementBar";

export default function TemplatesPage() {
  const { isLoaded } = useAuth();
  const announcementBarHeight = useAnnouncementBarHeight();
  const mainContainerHeight = `calc(100dvh - ${announcementBarHeight}px)`;

  if (!isLoaded) {
    return (
      <>
        <MgHead title="Templates" />
        <AnnouncementBar />
        <Box w="full" h={mainContainerHeight} mt={`${announcementBarHeight}px`}>
          {/* Loading state can be added here if needed */}
        </Box>
      </>
    );
  }

  return (
    <>
      <MgHead title="Templates" />
      <AnnouncementBar />

      <Flex w="full" h={mainContainerHeight} mt={`${announcementBarHeight}px`}>
        {/* Desktop Layout */}
        <Box display={{ base: "none", md: "flex" }} w="full" h="full">
          <DesktopLayout>
            <DesktopTemplatesScreen />
          </DesktopLayout>
        </Box>

        {/* Mobile Layout */}
        <Box display={{ base: "flex", md: "none" }} w="full" h="full">
          <MobileTemplatesScreen />
        </Box>
      </Flex>
    </>
  );
}
