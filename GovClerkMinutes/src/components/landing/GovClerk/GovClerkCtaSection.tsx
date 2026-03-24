import { Box, Container, Heading, Text, VStack, Button } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useAuth } from "@clerk/nextjs";
import { safeCapture } from "@/utils/safePosthog";
import { scrollToIntakeForm, scrollToQuoteForm } from "../IntakeForm";

export const CtaSection = () => {
  const { isLoaded, userId } = useAuth();
  const router = useRouter();
  const isPricingPage = router.pathname === "/pricing";
  const isBlogPage = router.pathname.startsWith("/blog");
  const ctaText = isBlogPage ? "Return Home" : isPricingPage ? "Request Pricing" : "Book a Demo";

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

  const handleCtaClick = () => {
    safeCapture("final_cta_clicked", {
      variant: "v2",
      type: isBlogPage ? "blog_home" : isPricingPage ? "request_quote" : "book_demo",
      destination: isBlogPage ? "home" : "quote_request_form",
      route: router.pathname,
    });

    if (isBlogPage) {
      router.push("/");
      return;
    }

    const scrollSuccess = scrollToQuoteForm();

    if (!scrollSuccess) {
      scrollToIntakeForm();
    }
  };

  return (
    <Box
      as="section"
      py={{ base: 16, md: 24 }}
      bg="white"
      onMouseEnter={() => {
        safeCapture("new_landing_page_section_seen", {
          section: "final_cta",
          variant: "v2",
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
                Ready to Transform Your Meeting Minutes?
              </Heading>
              <Text fontSize={{ base: "lg", md: "xl" }} color="gray.600" maxW="2xl">
                Join thousands of professionals who save hours every week with AI-powered meeting
                minutes
              </Text>
            </VStack>

            {isLoaded && userId ? (
              <Button
                onClick={() => router.push("/dashboard")}
                bg="blue.500"
                _hover={hoverEffect("blue.600")}
                {...buttonBaseProps}
              >
                Go to Dashboard
              </Button>
            ) : (
              <Button
                bg="#FF6B35"
                _hover={hoverEffect("#E65A2E")}
                {...buttonBaseProps}
                onClick={handleCtaClick}
              >
                {ctaText}
              </Button>
            )}
          </VStack>
        </Box>
      </Container>
    </Box>
  );
};
