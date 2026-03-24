export type FaqItem = {
  question: string;
  answer: string;
};

export const faqData: FaqItem[] = [
  {
    question: "What types of organizations use GovClerk?",
    answer:
      "GovClerk is designed for government bodies, school boards, nonprofit organizations, HOAs, and any committee or board that needs structured meeting documentation. Our platform is particularly popular with municipal governments and county councils.",
  },
  {
    question: "How does the AI meeting minutes generation work?",
    answer:
      "Simply record your meeting through our built-in recorder or upload an audio/video file. Our AI transcribes the discussion, identifies speakers, extracts key decisions and action items, and generates professionally formatted minutes, typically within minutes of your meeting ending.",
  },
  {
    question: "How accurate is the transcription?",
    answer:
      "Our speech-to-text engine delivers industry-leading accuracy with automatic speaker identification. We support 96+ languages and continuously improve our models. You can review and edit transcripts before finalizing your minutes.",
  },
  {
    question: "Is GovClerk compliant with open meeting laws?",
    answer:
      "Yes. GovClerk is built with public sector compliance in mind. Our public portal feature helps you meet transparency requirements by publishing agendas, minutes, and meeting records for public access.",
  },
  {
    question: "Can I export minutes to Word or PDF?",
    answer:
      "Absolutely. GovClerk supports one-click export to Microsoft Word (.docx) and PDF formats with professional formatting. Your documents are ready to distribute, file, or publish.",
  },
  {
    question: "What security measures are in place?",
    answer:
      "GovClerk employs SOC 2 compliance standards, AES-256 encryption at rest and in transit, role-based access controls, and secure cloud storage. We are built to handle sensitive government and organizational data.",
  },
  {
    question: "How long does it take to get started?",
    answer:
      "Most organizations are up and running within a day. Book a demo and our team will walk you through setup, configuration, and best practices for your specific use case.",
  },
];
