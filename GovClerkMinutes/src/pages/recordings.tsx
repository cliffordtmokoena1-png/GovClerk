import React from "react";
import { Box, Container, Text, Flex } from "@chakra-ui/react";
import { useAuth } from "@clerk/nextjs";
import MgHead from "@/components/MgHead";
import { withGsspErrorHandling } from "@/error/withErrorReporting";
import RecordingsList from "@/components/recordings/RecordingsList";
import DesktopLayout from "@/components/layouts/DesktopLayout";
import AnnouncementBar, { useAnnouncementBarHeight } from "@/components/AnnouncementBar";
import HeroBanner from "@/components/shared/HeroBanner";
import ContentCard from "@/components/shared/ContentCard";
import { FaMicrophone } from "react-icons/fa";

export const getServerSideProps = withGsspErrorHandling(async () => {
  return {
    props: {},
  };
});

export default function RecordingsPage() {
  const { isLoaded } = useAuth();
  const announcementBarHeight = useAnnouncementBarHeight();
  const mainContainerHeight = `calc(100dvh - ${announcementBarHeight}px)`;

  if (!isLoaded) {
    return (
      <>
        <MgHead title="Recordings" />
        <AnnouncementBar />
        <Container maxW="container.lg" py={8}>
          <Text>Loading...</Text>
        </Container>
      </>
    );
  }

  const recordingsContent = (
    <Flex direction="column" w="full" bg="gray.50" minH="100%">
      <HeroBanner
        badge="LOCAL STORAGE"
        heading="Your Recordings"
        subtitle="Download and manage your audio recordings stored locally on this device"
      />
      <Box maxW="5xl" mx="auto" w="full" px={{ base: 4, md: 6 }} py={{ base: 6, md: 8 }}>
        <ContentCard icon={FaMicrophone} title="Recordings">
          <Box p={6}>
            <RecordingsList />
          </Box>
        </ContentCard>
      </Box>
    </Flex>
  );

  return (
    <>
      <MgHead title="Recordings" />
      <AnnouncementBar />

      <Flex w="full" h={mainContainerHeight} mt={`${announcementBarHeight}px`}>
        <Box display={{ base: "none", md: "flex" }} w="full" h="full">
          <DesktopLayout>
            {recordingsContent}
          </DesktopLayout>
        </Box>

        <Box display={{ base: "flex", md: "none" }} w="full" h="full" overflowY="auto">
          {recordingsContent}
        </Box>
      </Flex>
    </>
  );
}
