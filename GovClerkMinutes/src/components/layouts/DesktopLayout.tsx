import React, { useCallback, ReactNode } from "react";
import { Flex } from "@chakra-ui/react";
import Sidebar from "../Sidebar";
import { ModalType } from "@/pages/dashboard/[[...slug]]";
import { ApiSidebarResponse } from "@/pages/api/sidebar";
import { ApiGetCustomerDetailsResponse } from "@/pages/api/get-customer-details";
import { useLocalStorage } from "@/hooks/useLocalStorage";

type Props = {
  children: ReactNode;
  selectedTranscript?: number | null;
  initialSidebarItems?: ApiSidebarResponse | null;
  initialCustomerDetails?: ApiGetCustomerDetailsResponse | null;
  initialToken?: number | null;
  onOpen?: (modalType: ModalType) => void;
  filePickerTrigger?: React.MutableRefObject<(() => void) | null>;
};

export default function DesktopLayout({
  children,
  selectedTranscript,
  initialSidebarItems,
  initialCustomerDetails,
  initialToken,
  onOpen,
  filePickerTrigger,
}: Props) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage(
    "mg-sidebar-collapsed",
    false
  );

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, [setIsSidebarCollapsed]);

  const handleModalOpen = useCallback(
    (modalType: ModalType) => {
      onOpen?.(modalType);
    },
    [onOpen]
  );

  return (
    <Flex direction="row" h="100%" w="100%" bg="gray.50">
      <Flex flexShrink={0}>
        <Sidebar
          selectedTranscript={selectedTranscript}
          onOpen={handleModalOpen}
          layoutKind="desktop"
          initialSidebarItems={initialSidebarItems}
          initialCustomerDetails={initialCustomerDetails}
          initialToken={initialToken}
          toggleSidebar={toggleSidebar}
          isCollapsed={isSidebarCollapsed}
          filePickerTrigger={filePickerTrigger}
        />
      </Flex>

      <Flex flex={1} minW={0} overflowY="auto">
        {children}
      </Flex>
    </Flex>
  );
}
