import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from "@chakra-ui/react";
import { safeCapture } from "@/utils/safePosthog";

interface FaqItem {
  q: string;
  a: string;
}

const defaultFaqs: FaqItem[] = [
  {
    q: "How do the AI generated meeting minutes work?",
    a: "Our AI analyzes the recording of your meeting, transcribes the spoken words, and then uses advanced NLP techniques to summarize the key points and decisions made during the meeting.",
  },
  {
    q: "What file formats do you support?",
    a: "We support all major audio and video formats including MP3, MP4, WAV, M4A, and more.",
  },
  {
    q: "How accurate is the transcription?",
    a: "Our AI transcription is highly accurate and continuously improving. For most clear recordings, we achieve over 96.4% accuracy. However, it is always recommended to manually review and adjust the minutes for maximum accuracy.",
  },
  {
    q: "How do I get a meeting recording to upload?",
    a: "Zoom, Microsoft Teams, and Google Meet all allow you to record meetings to a local file. Find that file and upload it here.",
  },
  {
    q: "How long does it take to process a recording?",
    a: "Most recordings are processed within minutes. The exact time depends on the length of your recording.",
  },
  {
    q: "Can I edit the minutes after they're generated?",
    a: "Yes! You can edit any part of your minutes including speaker labels, text, and formatting.",
  },
  {
    q: "Is my data secure?",
    a: "Absolutely. We take data security very seriously. Your meeting recordings and transcriptions are securely stored, encrypted, and are only accessible by you.",
  },
  {
    q: "What languages does the AI support?",
    a: "Our AI currently supports over 96+ languages with plans for more languages in the future. We can also output minutes in languages other than English.",
  },
];

const faqItemStyles = {
  border: "1px solid",
  borderColor: "rgba(59, 130, 246, 0.2)",
  bg: "rgba(255, 255, 255, 0.8)",
  backdropFilter: "blur(8px)",
  mb: 4,
  borderRadius: "xl",
  transition: "all 0.2s",
};

const faqHoverStyles = {
  "@media (hover: hover)": {
    borderColor: "rgba(59, 130, 246, 0.4)",
    bg: "rgba(239, 246, 255, 0.4)",
  },
};

export const FaqSection = () => {
  return (
    <Box
      as="section"
      py={{ base: 16, md: 24 }}
      bg="white"
      onMouseEnter={() => {
        safeCapture("new_landing_page_section_seen", {
          section: "faq",
          variant: "v2",
        });
      }}
    >
      <Container maxW="4xl">
        <VStack spacing={{ base: 8, md: 12 }}>
          <VStack spacing={4} textAlign="center">
            <Heading
              as="h2"
              fontSize={{ base: "3xl", md: "5xl" }}
              fontWeight="normal"
              fontFamily="Georgia, serif"
              color="gray.800"
            >
              Frequently Asked Questions
            </Heading>
            <Text fontSize={{ base: "lg", md: "xl" }} color="gray.600">
              Have questions? We&apos;re here to help.
            </Text>
          </VStack>

          <Accordion allowToggle w="full">
            {defaultFaqs.map((faq, idx) => (
              <AccordionItem
                key={idx}
                {...faqItemStyles}
                _last={{ mb: 0 }}
                _hover={faqHoverStyles}
                onClick={() => {
                  safeCapture("new_faq_clicked", { idx, question: faq.q, variant: "v2" });
                }}
              >
                <AccordionButton
                  py={5}
                  px={6}
                  borderRadius="xl"
                  _expanded={{ borderBottomRadius: 0 }}
                >
                  <Heading
                    flex={1}
                    fontSize={{ base: "md", md: "lg" }}
                    fontWeight="semibold"
                    textAlign="left"
                    color="gray.900"
                  >
                    {faq.q}
                  </Heading>
                  <AccordionIcon fontSize="24px" color="blue.500" />
                </AccordionButton>
                <AccordionPanel
                  pb={6}
                  px={6}
                  pt={4}
                  borderTop="1px solid"
                  borderColor="rgba(59, 130, 246, 0.1)"
                >
                  <Text color="gray.700" fontSize={{ base: "md", md: "lg" }} lineHeight="tall">
                    {faq.a}
                  </Text>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </VStack>
      </Container>
    </Box>
  );
};
