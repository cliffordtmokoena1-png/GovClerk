import React, { ReactNode, cloneElement, isValidElement, useCallback } from "react";
import { Flex } from "@chakra-ui/react";
import BottomBar from "../BottomBar";
import MobileHomeScreen from "../mobile/MobileHomeScreen";
import MobileRecordingsScreen from "../mobile/MobileRecordingsScreen";
import MobileTemplatesScreen from "../mobile/MobileTemplatesScreen";
import MobileAccountScreen from "../mobile/MobileAccountScreen";
import { LayoutKind, ModalType } from "@/pages/dashboard/[[...slug]]";
import { ApiSidebarResponse } from "@/pages/api/sidebar";
import { ApiGetCustomerDetailsResponse } from "@/pages/api/get-customer-details";
import useMobileView, { MobileView } from "@/hooks/useMobileView";

type Props = Readonly<{
  children: ReactNode;
  selectedTranscript?: number | null;
  initialSidebarItems?: ApiSidebarResponse | null;
  initialCustomerDetails?: ApiGetCustomerDetailsResponse | null;
  initialToken?: number | null;
  onOpen?: (modalType: ModalType) => void;
  filePickerTrigger?: React.RefObject<(() => void) | null>;
  modalType: ModalType;
  highlightGetMinutesButton: boolean;
}>;

export default function MobileLayout({
  children,
  selectedTranscript,
  initialSidebarItems,
  initialCustomerDetails,
  initialToken,
  onOpen,
  filePickerTrigger,
  modalType,
  highlightGetMinutesButton,
}: Props) {
  const [mobileView, setMobileView] = useMobileView(selectedTranscript);

  const childrenWithLayoutKind = isValidElement(children)
    ? cloneElement(children, {
        layoutKind: mobileView,
        removePadding: mobileView === "dashboard-transcript" || mobileView === "dashboard-minutes",
      } as { layoutKind: LayoutKind; removePadding?: boolean })
    : children;

  const handleModalOpen = useCallback(
    (modalType: ModalType) => {
      onOpen?.(modalType);
    },
    [onOpen]
  );

  const handleLayoutChange = useCallback(
    (layout: LayoutKind) => {
      setMobileView(layout as MobileView);
    },
    [setMobileView]
  );

  const showFilePickerTrigger = selectedTranscript == null ? filePickerTrigger : undefined;

  const renderContent = () => {
    switch (mobileView) {
      case "home":
      case "past-meetings":
        return (
          <MobileHomeScreen
            selectedTranscript={selectedTranscript}
            initialSidebarItems={initialSidebarItems}
            initialCustomerDetails={initialCustomerDetails}
            initialToken={initialToken}
            onOpen={handleModalOpen}
            filePickerTrigger={showFilePickerTrigger}
          />
        );
      case "recordings":
        return <MobileRecordingsScreen />;
      case "templates":
        return <MobileTemplatesScreen />;
      case "account":
        return <MobileAccountScreen onOpen={handleModalOpen} />;
      case "new-meeting":
      case "dashboard-transcript":
      case "dashboard-minutes":
      default:
        return (
          <Flex flex={1} minH={0}>
            {childrenWithLayoutKind}
          </Flex>
        );
    }
  };

  return (
    <Flex direction="column" h="100%" w="100%">
      {renderContent()}

      <Flex flexShrink={0} w="100%">
        <BottomBar layoutKind={mobileView} onLayoutChange={handleLayoutChange} />
      </Flex>
    </Flex>
  );
}
