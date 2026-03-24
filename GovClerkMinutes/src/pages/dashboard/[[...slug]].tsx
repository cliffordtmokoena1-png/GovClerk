import React, {
  useCallback,
  useState,
  useRef,
  useLayoutEffect,
} from "react";
import ProductPage from "@/components/ProductPage";
import { Flex, Box, useDisclosure } from "@chakra-ui/react";
import MgHead from "@/components/MgHead";
import SimplePricingModal from "@/components/SimplePricingModal";
import ReferralModal from "@/components/ReferralModal";
import AnnouncementBar, { useAnnouncementBarHeight } from "@/components/AnnouncementBar";
import DesktopLayout from "@/components/layouts/DesktopLayout";
import MobileLayout from "@/components/layouts/MobileLayout";
import HeroBanner from "@/components/shared/HeroBanner";

import { ApiTranscriptStatusResponseResult, getTranscriptStatus } from "../api/transcript-status";
import { getAuth } from "@clerk/nextjs/server";
import { getCountry } from "../api/get-country";
import { ApiSidebarResponse } from "../api/sidebar";
import { ApiGetCustomerDetailsResponse } from "../api/get-customer-details";
import UpgradePlanConfirmModal from "@/components/UpgradePlanConfirmModal";
import isMobile from "@/utils/isMobile";
import { isDev } from "@/utils/dev";
import { waitUntil } from "@vercel/functions";
import { capture } from "@/utils/posthog";
import { getTimer } from "@/utils/timer";
import { withGsspErrorHandling } from "@/error/withErrorReporting";
import { useNetworkAnalytics } from "@/hooks/useNetworkAnalytics";
import { useNetworkAnnouncements } from "@/hooks/useNetworkAnnouncements";
import { useUploadFailureAnnouncements } from "@/hooks/useUploadFailureAnnouncements";

export type LayoutKind =
  | "desktop"
  | "home"
  | "recordings"
  | "new-meeting"
  | "templates"
  | "account"
  | "dashboard-transcript"
  | "dashboard-minutes"
  | "past-meetings";

export type ModalType = "pricing" | "referral" | "upgrade";

type Props = {
  transcriptId: number | null;
  transcriptStatus: ApiTranscriptStatusResponseResult | null;
  country: string | null;
  sidebarItems: ApiSidebarResponse | null;
  customerDetails: ApiGetCustomerDetailsResponse | null;
  tokens: number | null;
  isMobile: boolean;
};

export const getServerSideProps = withGsspErrorHandling(async (context) => {
  const timer = getTimer({ clearTimer: true });
  timer.start("dashboard_get_serverside_props");

  const transcriptId = context.params?.slug
    ? Number.parseInt(context.params.slug[0] as string)
    : undefined;

  timer.start("get_auth");
  const { userId } = getAuth(context.req);
  if (userId == null) {
    return {
      notFound: true,
    };
  }
  timer.stop("get_auth");

  timer.start("get_transcript_status");
  const transcriptStatus = transcriptId ? await getTranscriptStatus(transcriptId, userId) : null;
  timer.stop("get_transcript_status");

  const country = isDev() ? "US" : getCountry((h) => context.req.headers[h] as any);

  timer.stop("dashboard_get_serverside_props");

  waitUntil(
    (async () => {
      if (userId == null) {
        return;
      }

      capture(
        "dashboard_get_serverside_props",
        {
          duration: timer.get("dashboard_get_serverside_props"),
          transcript_id: transcriptId,
          country,
          get_auth_duration: timer.get("get_auth"),
          get_transcript_status_duration: timer.get("get_transcript_status"),
        },
        userId
      );
    })()
  );

  return {
    props: {
      ...(transcriptId == null ? {} : { transcriptId }),
      transcriptStatus,
      country,
      sidebarItems: null,
      customerDetails: null,
      tokens: null,
      isMobile: isMobile(context.req.headers),
    },
  };
});

const Home = ({
  transcriptId,
  transcriptStatus,
  country,
  sidebarItems,
  customerDetails,
  tokens,
  isMobile,
}: Props) => {
  const [highlightGetMinutesButton, setHighlightGetMinutesButton] = useState<boolean>(false);
  const filePickerTriggerRef = useRef<(() => void) | null>(null);

  const [modalType, setModalType] = useState<ModalType>("pricing");
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [isDesktop, setIsDesktop] = useState(!isMobile);

  useLayoutEffect(() => {
    const checkBreakpoint = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    checkBreakpoint();
    window.addEventListener("resize", checkBreakpoint);
    return () => window.removeEventListener("resize", checkBreakpoint);
  }, []);

  useNetworkAnalytics();
  useNetworkAnnouncements();
  useUploadFailureAnnouncements();

  const announcementBarHeight = useAnnouncementBarHeight();

  const openModal = useCallback(
    (modalType: ModalType) => {
      setModalType(modalType);
      onOpen();
    },
    [onOpen]
  );

  const mainContainerHeight = `calc(100dvh - ${announcementBarHeight}px)`;

  return (
    <>
      <MgHead noindex />
      <AnnouncementBar />
      <Flex
        flexDir={{ base: "column", md: "row" }}
        w="full"
        h={mainContainerHeight}
        mt={`${announcementBarHeight}px`}
      >
        {(() => {
          switch (modalType) {
            case "pricing":
              return (
                <SimplePricingModal
                  isOpen={isOpen}
                  onClose={onClose}
                  country={country}
                  customerDetails={customerDetails}
                />
              );
            case "referral":
              return <ReferralModal isOpen={isOpen} onClose={onClose} />;
            case "upgrade":
              return (
                <UpgradePlanConfirmModal
                  transcriptId={transcriptId ?? undefined}
                  country={country ?? "US"}
                  planName={customerDetails?.planName ?? "Basic"}
                  isOpen={isOpen}
                  onClose={onClose}
                />
              );
            default:
              return null;
          }
        })()}

        {!isMobile && (
          <Box display={isDesktop ? "flex" : "none"} h="100%" w="100%">
            <DesktopLayout
              selectedTranscript={transcriptId}
              initialSidebarItems={sidebarItems}
              initialCustomerDetails={customerDetails}
              initialToken={tokens}
              onOpen={openModal}
              filePickerTrigger={transcriptId == null ? filePickerTriggerRef : undefined}
            >
              {transcriptId == null ? (
                <Flex direction="column" w="full" bg="gray.50" minH="100%">
                  <HeroBanner
                    badge="AI-POWERED"
                    heading="Meeting Minutes Dashboard"
                    subtitle="Upload audio recordings and generate professional meeting minutes with AI"
                  />
                  <ProductPage
                    key={transcriptId}
                    transcriptId={transcriptId}
                    initialTranscriptStatus={transcriptStatus}
                    layoutKind="desktop"
                    setHighlightGetMinutesButton={setHighlightGetMinutesButton}
                    country={country}
                    onFilePickerTrigger={filePickerTriggerRef}
                  />
                </Flex>
              ) : (
                <ProductPage
                  key={transcriptId}
                  transcriptId={transcriptId}
                  initialTranscriptStatus={transcriptStatus}
                  layoutKind="desktop"
                  setHighlightGetMinutesButton={setHighlightGetMinutesButton}
                  country={country}
                />
              )}
            </DesktopLayout>
          </Box>
        )}
        {(isMobile || !isDesktop) && (
          <Box display={isDesktop ? "none" : "flex"} h="100%" w="100%">
            <MobileLayout
              selectedTranscript={transcriptId}
              initialSidebarItems={sidebarItems}
              initialCustomerDetails={customerDetails}
              initialToken={tokens}
              onOpen={openModal}
              filePickerTrigger={transcriptId == null ? filePickerTriggerRef : undefined}
              modalType={modalType}
              highlightGetMinutesButton={highlightGetMinutesButton}
            >
              {transcriptId == null ? (
                <Flex direction="column" w="full" bg="gray.50" overflowY="auto">
                  <HeroBanner
                    badge="AI-POWERED"
                    heading="Meeting Minutes Dashboard"
                    subtitle="Upload audio recordings and generate professional meeting minutes with AI"
                  />
                  <ProductPage
                    key={transcriptId}
                    transcriptId={transcriptId}
                    initialTranscriptStatus={transcriptStatus}
                    layoutKind="new-meeting"
                    setHighlightGetMinutesButton={setHighlightGetMinutesButton}
                    country={country}
                    onFilePickerTrigger={filePickerTriggerRef}
                  />
                </Flex>
              ) : (
                <ProductPage
                  key={transcriptId}
                  transcriptId={transcriptId}
                  initialTranscriptStatus={transcriptStatus}
                  layoutKind="new-meeting"
                  setHighlightGetMinutesButton={setHighlightGetMinutesButton}
                  country={country}
                />
              )}
            </MobileLayout>
          </Box>
        )}
      </Flex>
    </>
  );
};

export default Home;
