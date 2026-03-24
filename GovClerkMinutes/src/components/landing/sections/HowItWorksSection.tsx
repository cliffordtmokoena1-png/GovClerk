import { Box, Container, Heading, Text, VStack } from "@chakra-ui/react";
import { safeCapture } from "@/utils/safePosthog";

export const HowItWorksSection = () => {
  return (
    <Box
      as="section"
      id="how-it-works"
      py={{ base: 16, md: 24 }}
      bg="#152a4e"
      onMouseEnter={() => {
        safeCapture("new_landing_page_section_seen", {
          section: "how_it_works",
          variant: "v2",
        });
      }}
    >
      <Container maxW="7xl">
        <VStack spacing={4} textAlign="center">
          <Heading
            as="h2"
            fontSize={{ base: "3xl", md: "5xl" }}
            fontWeight="normal"
            fontFamily="Georgia, serif"
            color="white"
          >
            {/* GovClerk Minutes */}
          </Heading>
        </VStack>
      </Container>
    </Box>
  );
};