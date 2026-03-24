import { Box, Container, Heading, Text, VStack, Button } from "@chakra-ui/react";
import { safeCapture } from "@/utils/safePosthog";
import { scrollToIntakeForm, scrollToQuoteForm } from "../IntakeForm";

export const TalkToSalesSection = () => {
  const buttonBaseProps = {
    size: "lg" as const,
    color: "white",
    px: 12,
    py: 7,
    fontSize: "lg",
    transition: "all 0.2s",
  };

  const hoverEffect = (bg: string) => ({
    "@media (hover: hover)": { bg, boxShadow: "xl", transform: "translateY(-2px)" },
  });

  return (
    <Box
      as="section"
      py={{ base: 16, md: 24 }}
      bg="white"
      onMouseEnter={() => {
        safeCapture("new_landing_page_section_seen", {
          section: "talk_to_sales",
          variant: "enterprise",
        });
      }}
    >
      <Container maxW="7xl">
        <Box
          bg="rgba(239, 246, 255, 0.5)"
          backdropFilter="blur(12px)"
          borderRadius="3xl"
          border="1px solid"
          borderColor="rgba(59, 130, 246, 0.3)"
          p={{ base: 10, md: 16 }}
          textAlign="center"
        >
          <VStack spacing={8}>
            <VStack spacing={4}>
              <Heading
                as="h2"
                fontSize={{ base: "3xl", md: "5xl" }}
                fontWeight="normal"
                fontFamily="Georgia, serif"
                color="gray.800"
                maxW="3xl"
              >
                Need a Custom Enterprise Solution?
              </Heading>
              <Text fontSize={{ base: "lg", md: "xl" }} color="gray.600" maxW="2xl">
                Talk to our sales team for volume pricing, dedicated support, and custom
                integrations
              </Text>
            </VStack>

            <Button
              as="a"
              href="#intake-form"
              bg="blue.500"
              _hover={hoverEffect("blue.600")}
              {...buttonBaseProps}
              onClick={(e) => {
                e.preventDefault();
                safeCapture("talk_to_sales_clicked", {
                  variant: "enterprise",
                });
                if (!scrollToQuoteForm()) {
                  scrollToIntakeForm();
                }
              }}
            >
              Get a Quote
            </Button>
          </VStack>
        </Box>
      </Container>
    </Box>
  );
};
