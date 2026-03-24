import { UploadKind } from "@/uploadKind/uploadKind";
import { Box, Text, Button, VStack, Flex, useBreakpointValue } from "@chakra-ui/react";

type Props = {
  uploadKind?: UploadKind;
  onFinishClick: () => void;
  isLoading?: boolean;
};

export default function FinishMinutesBanner({ uploadKind, onFinishClick, isLoading }: Props) {
  const isMobile = useBreakpointValue({ base: true, md: false });

  if (uploadKind == null) {
    return null;
  }

  const mobileBannerText = (
    <VStack spacing={0} align="center">
      <Text fontSize="sm" textAlign="center">
        Your subscription is active! Click below to finish your minutes.
      </Text>
    </VStack>
  );

  const desktopBannerText = (
    <Text fontSize="sm">Your subscription is active! Click here to finish your minutes.</Text>
  );

  const finishButton = (
    <Button
      size="sm"
      bg="white"
      color="green.500"
      _hover={{
        opacity: 0.8,
      }}
      transition="opacity 0.2s"
      onClick={onFinishClick}
      px={6}
      isLoading={isLoading}
      loadingText="Generating..."
    >
      Finish Minutes
    </Button>
  );

  return (
    <Box bg="green.500" color="white" py={2} width="100%" boxShadow="sm">
      <Box maxW="container.xl" mx="auto" px={4} display="flex" justifyContent="center">
        <Box maxW="2xl" w="full">
          {isMobile ? (
            <VStack spacing={2} align="center">
              {mobileBannerText}
              {finishButton}
            </VStack>
          ) : (
            <Flex gap={4} align="center" justify="center">
              {desktopBannerText}
              {finishButton}
            </Flex>
          )}
        </Box>
      </Box>
    </Box>
  );
}
