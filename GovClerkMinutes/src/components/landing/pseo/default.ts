import { LandingPageContent } from "@/types/landingPage";

/**
 * Default content for the landing page
 * Contains all the current copy and configuration from the existing landing page
 */
export const defaultContent: LandingPageContent = {
  hero: {
    title: "Create meeting minutes",
    subtitle: "Upload a meeting recording and get a high quality transcript and summary.",
    subheadline: "6,000+ professionals automate meeting minutes with us",
    image: "/landing-product.png",
    mobileImage: "/landing-product-mobile.png",
  },
  features: [
    {
      title: "Minutes & Transcript",
      description: "Upload a video or audio recording to get a transcript and meeting minutes",
      iconName: "MdRecordVoiceOver",
    },
    {
      title: "Upload Transcript",
      description: "Generate minutes from an existing transcript",
      iconName: "MdDescription",
    },
    {
      title: "Remember Speakers",
      description: "Past speaker names are detected and auto-filled across meetings",
      iconName: "MdPeople",
    },
    {
      title: "Fast Turnaround",
      description: "Get your minutes in minutes, not hours",
      iconName: "MdSpeed",
    },
    {
      title: "Mobile Editing",
      description: "Edit your minutes on any device, anywhere",
      iconName: "MdDevices",
    },
    {
      title: "Easy Export",
      description: "Download as a Microsoft Word document",
      iconName: "MdFileDownload",
    },
  ],
  testimonials: [
    {
      quote:
        "I love it. I normally take 5 days to do minutes but with this it was done in just below an hour! It's so professional, doesn't leave out important details and saves me so much time.",
      author: "Lucy M.",
      role: "GovClerkMinutes customer",
      image: "/lucy.jpg",
    },
    {
      quote:
        "I like it! I can easily take these bullets from the summary and have Chat GPT turn them into more of a narrative. Transcript is good too!",
      author: "Lisa T.",
      role: "Business Manager at MinutesWriters",
      useInitials: true,
      initials: "LT",
    },
  ],
  faqs: [
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
      a: "Our AI transcription is highly accurate and continuously improving. For most clear recordings, we achieve over 95% accuracy. However, it is always recommended to manually review and adjust the minutes for maximum accuracy.",
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
      a: "Our AI currently supports English, Spanish, French, and German with plans for more languages in the future. We can also output minutes in languages other than English.",
    },
    {
      q: "When do tokens renew?",
      a: "Tokens renew every month on the date of your first purchase. The renewal cadence is the same as the monthly billing cycle.",
    },
    {
      q: "Is payment secure?",
      a: "Yes, we use PayStack for payment. We do not store any of your token card information.",
    },
    {
      q: "Where is GovClerkMinutes located?",
      a: "We are located in New York City, USA.",
    },
  ],
  pricing: {
    header: "How much is your time worth?",
    subtitle: "Admins do a lot. Buy back your time so you can focus on high value tasks.",
  },
  letter: {
    targetPersona: "Administrative Professional",
  },
  finalCta: {
    headline: "Start Generating Better Meeting Minutes Today",
    buttonText: "Get Started Free",
  },
  seo: {
    title: "GovClerkMinutes: AI Meeting Minutes Generator",
    description:
      "Automatically generate meeting minutes from your audio or video recordings. Keep track of important decisions, tasks, and topics discussed during your meetings.",
    keywords:
      "Meeting, Minutes, Generator, Transcription, Audio, Video, Productivity, Efficiency, AI",
    canonical: "https://GovClerkMinutes.com/",
  },
};
