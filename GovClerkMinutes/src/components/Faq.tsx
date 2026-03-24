import {
  Flex,
  Heading,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from "@chakra-ui/react";
import { safeCapture } from "@/utils/safePosthog";

const FAQS = [
  {
    question: "How do the AI generated meeting minutes work?",
    answer:
      "Our AI analyzes the recording of your meeting, transcribes the spoken words, and then uses advanced NLP techniques to summarize the key points and decisions made during the meeting.",
  },
  {
    question: "How do I get a meeting recording to upload?",
    answer:
      "Zoom, Microsoft Teams, and Google Meet all allow you to record meetings to a local file.  Find that file and upload it here.",
  },
  {
    question: "Can I upload a transcript and generate meeting minutes from that?",
    answer: "Yes.",
  },
  {
    question: "Is my data secure with your product?",
    answer:
      "Absolutely. We take data security very seriously. Your meeting recordings and transcriptions are securely stored and are only accessible by you.",
  },
  {
    question: "What languages does the AI support?",
    answer:
      "Our AI currently supports English, Spanish, French, and German with plans for more languages in the future.",
  },
  {
    question: "How accurate are the AI generated minutes?",
    answer:
      "Our AI aims to provide high-quality transcriptions and summaries. However, it is always recommended to manually review and adjust the minutes for maximum accuracy.",
  },
  {
    question: "Is payment secure?",
    answer: "Yes, we use PayStack for payment. We do not store any of your token card information.",
  },
  {
    question: "Where is GovClerkMinutes located?",
    answer: "We are located in New York City, USA",
  },
  {
    question: "When do tokens renew?",
    answer:
      "Token renew every month on the date of your first purchase. The renewal cadence is the same as the monthly billing cycle.",
  },
  {
    question: "Can it output minutes in languages other than English?",
    answer: "Yes.",
  },
  {
    questionNotFound: true,
    question: "My question isn't in this list!",
    answer: "Use the chat widget on the right side of the screen to ask us anything!",
  },
];

type Props = {
  onQuestionNotFound: () => void;
};
const Faq = ({ onQuestionNotFound }: Props) => {
  return (
    <Flex
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      py={10}
      w="full"
      textAlign="left"
    >
      <Accordion allowToggle w="full">
        {FAQS.map(({ question, answer, questionNotFound }, idx) => {
          return (
            <AccordionItem
              key={idx}
              onClick={() => {
                safeCapture("faq_clicked", {
                  idx,
                  question,
                });

                if (questionNotFound) {
                  onQuestionNotFound();
                }
              }}
            >
              <AccordionButton>
                <Heading py={3} flex={1} size="md" fontWeight="semibold" textAlign="left">
                  {question}
                </Heading>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel pb={4}>{answer}</AccordionPanel>
            </AccordionItem>
          );
        })}
      </Accordion>
    </Flex>
  );
};

export default Faq;
