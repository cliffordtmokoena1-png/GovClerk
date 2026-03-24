import React, { useState, useCallback } from "react";
import { Flex, Box } from "@chakra-ui/react";
import MgHead from "@/components/MgHead";
import AnnouncementBar, { useAnnouncementBarHeight } from "@/components/AnnouncementBar";
import DesktopLayout from "@/components/layouts/DesktopLayout";
import BottomBar from "@/components/BottomBar";
import AgendaPage from "@/components/agendas/AgendaPage";
import AgendaHomePage from "@/components/agendas/AgendaHomePage";
import { getAuth } from "@clerk/nextjs/server";
import { withGsspErrorHandling } from "@/error/withErrorReporting";
import { getSidebarItems } from "../api/sidebar";
import { getCustomerDetails } from "../api/get-customer-details";
import { getCurrentBalance } from "../api/get-tokens";
import { ModalType, LayoutKind } from "../dashboard/[[...slug]]";
import SimplePricingModal from "@/components/SimplePricingModal";
import ReferralModal from "@/components/ReferralModal";
import UpgradePlanConfirmModal from "@/components/UpgradePlanConfirmModal";
import { useDisclosure } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { BOTTOM_BAR_HEIGHT_PX } from "@/components/BottomBar";

type Props = {
  agendaId: number | null;
  sidebarItems: any;
  customerDetails: any;
  tokens: number | null;
  country: string | null;
};

export const getServerSideProps = withGsspErrorHandling(async (context) => {
  const agendaId = context.params?.slug ? parseInt(context.params.slug[0] as string) : null;

  const { userId } = getAuth(context.req);
  if (userId == null) {
    return {
      notFound: true,
    };
  }

  const [sidebarItems, customerDetails, tokens] = await Promise.all([
    getSidebarItems(userId),
    getCustomerDetails(userId),
    getCurrentBalance(userId),
  ]);

  return {
    props: {
      agendaId,
      sidebarItems,
      customerDetails,
      tokens,
      country: "US",
    },
  };
});

export default function AgendasDashboardPage({
  agendaId,
  sidebarItems,
  customerDetails,
  tokens,
  country,
}: Props) {
  const router = useRouter();
  const announcementBarHeight = useAnnouncementBarHeight();
  const mainContainerHeight = `calc(100dvh - ${announcementBarHeight}px)`;
  const mobileContainerHeight = `calc(100dvh - ${announcementBarHeight}px - ${BOTTOM_BAR_HEIGHT_PX}px)`;
  const [modalType, setModalType] = useState<ModalType | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const openModal = useCallback(
    (type: ModalType) => {
      setModalType(type);
      onOpen();
    },
    [onOpen]
  );

  const handleLayoutChange = useCallback(
    (layout: LayoutKind) => {
      switch (layout) {
        case "home":
          router.push("/dashboard");
          break;
        case "recordings":
          router.push("/recordings");
          break;
        case "templates":
          router.push("/templates");
          break;
        case "new-meeting":
          router.push("/dashboard");
          break;
        default:
          break;
      }
    },
    [router]
  );

  return (
    <>
      <MgHead title="Agendas" noindex />
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
                  transcriptId={undefined}
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

        <Box display={{ base: "none", md: "flex" }} h="100%" w="100%">
          <DesktopLayout
            selectedTranscript={agendaId}
            initialSidebarItems={sidebarItems}
            initialCustomerDetails={customerDetails}
            initialToken={tokens}
            onOpen={openModal}
          >
            {agendaId ? <AgendaPage agendaId={agendaId} /> : <AgendaHomePage />}
          </DesktopLayout>
        </Box>

        <Flex display={{ base: "flex", md: "none" }} direction="column" h="100%" w="100%">
          <Box flex={1} h={mobileContainerHeight} overflowY="auto">
            {agendaId ? <AgendaPage agendaId={agendaId} /> : <AgendaHomePage />}
          </Box>
          <Box flexShrink={0} w="100%">
            <BottomBar layoutKind="account" onLayoutChange={handleLayoutChange} />
          </Box>
        </Flex>
      </Flex>
    </>
  );
}
