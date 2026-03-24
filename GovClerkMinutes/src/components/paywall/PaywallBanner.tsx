import {
  Box,
  Text,
  Button,
  VStack,
  Flex,
  useBreakpointValue,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect } from "react";
import PaywallHeader from "./PaywallHeader";
import { SubscriptionPlan } from "@/utils/price";
import { UploadKind } from "@/uploadKind/uploadKind";

type Props = {
  showPaywall: boolean;
  tokensRequired: number;
  currentBalance: number;
  uploadKind: UploadKind;
  onUpgradeClick: () => void;
  planName: SubscriptionPlan;
  country?: string;
  transcriptId?: number;
};

export default function PaywallBanner({
  showPaywall,
  tokensRequired,
  currentBalance,
  uploadKind,
  onUpgradeClick,
  planName,
  country,
  transcriptId,
}: Props) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const breakpoint = useBreakpointValue({ base: true, md: false });
  const isMobile = breakpoint ?? false; // Default to desktop view until breakpoint is determined

  useEffect(() => {
    if (showPaywall) {
      onOpen();
    }
  }, [showPaywall, onOpen]);

  const mobileBannerText = (
    <VStack spacing={0} align="center">
      <Text fontSize="sm" textAlign="center">
        This {uploadKind === "audio" ? "recording" : "transcript"} requires{" "}
        <Text as="span" fontWeight="bold">
          {tokensRequired}
        </Text>{" "}
        tokens, but you only have{" "}
        <Text as="span" fontWeight="bold">
          {currentBalance}
        </Text>{" "}
        token{currentBalance === 1 ? "" : "s"}
      </Text>
    </VStack>
  );

  const desktopBannerText = (
    <Text fontSize="sm">
      This {uploadKind === "audio" ? "recording" : "transcript"} requires{" "}
      <Text as="span" fontWeight="bold">
        {tokensRequired}
      </Text>{" "}
      tokens, but you only have{" "}
      <Text as="span" fontWeight="bold">
        {currentBalance}
      </Text>{" "}
      token{currentBalance === 1 ? "" : "s"}.
    </Text>
  );

  const handleUpgradeClick = () => {
    onOpen();
  };

  const handleModalClose = () => {
    onClose();
    onUpgradeClick();
  };

  const upgradeButton = (
    <Button
      size="sm"
      bg="white"
      color="blue.500"
      _hover={{
        opacity: 0.8,
      }}
      transition="opacity 0.2s"
      onClick={handleUpgradeClick}
      px={6}
    >
      Upgrade Now
    </Button>
  );

  return (
    <>
      <Box bg="blue.500" color="white" py={2} width="100%" boxShadow="sm">
        <Box maxW="container.xl" mx="auto" px={4} display="flex" justifyContent="center">
          <Box maxW="2xl" w="full">
            {isMobile ? (
              <VStack spacing={2} align="center">
                {mobileBannerText}
                {upgradeButton}
              </VStack>
            ) : (
              <Flex gap={4} align="center" justify="center">
                {desktopBannerText}
                {upgradeButton}
              </Flex>
            )}
          </Box>
        </Box>
      </Box>
      <PaywallHeader
        isOpen={isOpen}
        onClose={handleModalClose}
        tokensRequired={tokensRequired}
        currentBalance={currentBalance}
        uploadKind={uploadKind}
        country={country}
        transcriptId={transcriptId}
        planName={planName}
      />
    </>
  );
}
