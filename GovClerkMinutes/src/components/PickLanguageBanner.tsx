import { Box, Text, Button, VStack, Flex, useBreakpointValue } from "@chakra-ui/react";
import LanguagePickerModal from "./LanguagePickerModal";
import { useState } from "react";

type Props = {
  transcriptId?: number;
  country: string; // e.g. "ZA"
};

export default function PickLanguageBanner({ transcriptId, country }: Props) {
  const isMobile = useBreakpointValue({ base: true, md: false });
  const [isLanguagePickerOpen, setIsLanguagePickerOpen] = useState(true);

  const mobileBannerText = (
    <VStack spacing={0} align="center">
      <Text fontSize="sm" textAlign="center">
        Click below to select your language.
      </Text>
    </VStack>
  );

  const desktopBannerText = <Text fontSize="sm">Select a language to continue</Text>;

  const pickLanguageButton = (
    <Button
      size="sm"
      bg="white"
      color="blue.500"
      _hover={{
        opacity: 0.8,
      }}
      transition="opacity 0.2s"
      onClick={() => setIsLanguagePickerOpen(true)}
      px={6}
    >
      Set language
    </Button>
  );

  if (transcriptId == null) {
    return null;
  }

  return (
    <>
      <LanguagePickerModal
        isOpen={isLanguagePickerOpen}
        onClose={() => setIsLanguagePickerOpen(false)}
        country={country}
        transcriptId={transcriptId}
      />
      <Box bg="blue.500" color="white" py={2} width="100%" boxShadow="sm">
        <Box maxW="container.xl" mx="auto" px={4} display="flex" justifyContent="center">
          <Box maxW="2xl" w="full">
            {isMobile ? (
              <VStack spacing={2} align="center">
                {mobileBannerText}
                {pickLanguageButton}
              </VStack>
            ) : (
              <Flex gap={4} align="center" justify="center">
                {desktopBannerText}
                {pickLanguageButton}
              </Flex>
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
}
