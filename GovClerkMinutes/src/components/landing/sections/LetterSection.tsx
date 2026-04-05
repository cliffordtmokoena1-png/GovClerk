import { Box, Container, Heading, Text, VStack, Button, Divider } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useAuth } from "@clerk/nextjs";
import { safeCapture } from "@/utils/safePosthog";
import { scrollToIntakeForm, scrollToQuoteForm } from "../IntakeForm";

export const LetterSection = () => {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();

  const buttonBaseProps = {
    size: "lg" as const,
    color: "white",
    px: 10,
    py: 6,
    fontSize: "lg",
    w: { base: "full" as const, md: "auto" as const },
    transition: "all 0.2s",
  };

  const hoverEffect = (bg: string) => ({
    "@media (hover: hover)": { bg, transform: "translateY(-2px)" },
  });

  return (
    <Box
      as="section"
      pt={{ base: 3, md: 5 }}
      pb={{ base: 16, md: 24 }}
      bg="#152a4e"
      onMouseEnter={() => {
        safeCapture("new_landing_page_section_seen", {
          section: "letter",
          variant: "v2",
        });
      }}
    >
      <Container maxW="900px">
        <VStack spacing={{ base: 8, md: 12 }}>
          <Box
            w="full"
            maxW="210mm"
            minH={{ base: "auto", md: "297mm" }}
            bg="white"
            borderRadius="lg"
            border="1px solid"
            borderColor="gray.200"
            p={{ base: "1.5rem", md: "2.54cm" }}
            mx="auto"
          >
            <VStack spacing={8} align="stretch">
              <VStack align="start" spacing={1}>
                <Heading
                  fontSize={{ base: "2xl", md: "3xl" }}
                  fontFamily="Georgia, serif"
                  color="gray.900"
                  fontWeight="normal"
                >
                  A Personal Note from Our CEO
                </Heading>
                <Text fontSize="md" color="gray.500" fontWeight="light">
                  {new Date().toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
              </VStack>

              <Divider borderColor="gray.200" />

              <Text fontSize="lg" color="gray.700" lineHeight="1.8" fontWeight="light">
                Dear{" "}
                <Text as="span" fontStyle="italic" fontWeight="normal">
                  Professional,
                </Text>
              </Text>

              <VStack
                spacing={5}
                align="stretch"
                fontSize="lg"
                color="gray.700"
                lineHeight="1.8"
                fontWeight="light"
              >
                <Text>I want you to stop writing meeting minutes.</Text>

                <Text>
                  You spend hours every month listening back to meeting recordings. You
                  painstakingly assemble a document from countless topics and agendas. Be detailed,
                  but not too detailed.
                </Text>

                <Text>It takes away your time. It is boring. It is difficult.</Text>

                <Text>
                  You have better tasks to do. And so I am advocating for you to{" "}
                  <Text as="span" fontWeight="normal" color="gray.900">
                    stop writing meeting minutes.
                  </Text>
                </Text>

                <Text>Instead, I would like you to try something new.</Text>

                <Text>
                  GovClerkMinutes can write your minutes faster than you can. A lot faster. It is
                  more detailed, and extremely easy to use. I want you to try our service, because
                  it will{" "}
                  <Text as="span" fontWeight="normal" color="gray.900">
                    make your life better.
                  </Text>
                </Text>

                <Text>
                  Your boss will compliment the quality of your work. This can help you get a raise,
                  or get promoted. I want these outcomes for you.
                </Text>

                <Text>
                  More importantly, your life will get a big upgrade. You will eliminate the task
                  you hate the most. It will become fast, easy, and automated.
                </Text>

                <Text>Create an account and try us out for free. It will change your life.</Text>
              </VStack>

              <VStack align="start" spacing={0} pt={6}>
                <Text fontSize="lg" color="gray.900" fontFamily="Georgia, serif" fontWeight="light">
                  Sincerely,
                </Text>
                <Text
                  fontSize="xl"
                  fontWeight="normal"
                  color="gray.900"
                  fontFamily="Georgia, serif"
                  mt={2}
                >
                  Cliff Mokoena
                </Text>
                <Text
                  fontSize="md"
                  color="gray.600"
                  fontFamily="Georgia, serif"
                  fontStyle="italic"
                  fontWeight="light"
                >
                  Founder, GovClerk Minutes
                </Text>
              </VStack>

              <Divider borderColor="gray.200" mt={8} />

              <VStack spacing={4} pt={4}>
                <Text fontSize="md" color="gray.600" textAlign="center" fontWeight="light">
                  Ready to transform your meeting minutes process?
                </Text>
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
                    as="a"
                    href="#intake-form"
                    bg="#FF6B35"
                    _hover={hoverEffect("#E65A2E")}
                    {...buttonBaseProps}
                    onClick={(e) => {
                      e.preventDefault();
                      safeCapture("letter_cta_clicked", {
                        variant: "v2",
                      });
                      if (!scrollToQuoteForm()) {
                        scrollToIntakeForm();
                      }
                    }}
                  >
                    Book a demo
                  </Button>
                )}
              </VStack>
            </VStack>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
};
