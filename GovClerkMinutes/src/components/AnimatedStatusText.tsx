import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Text } from "@chakra-ui/react";

const STATUS_VARIANTS: string[][] = [
  [
    "Transcribing your meeting...",
    "Listening carefully...",
    "Identifying speakers...",
    "Converting speech to text...",
    "Processing audio...",
  ],
  [
    "Extracting key points...",
    "Summarizing highlights...",
    "Capturing action items...",
    "Pulling important details...",
    "Organizing notes...",
  ],
  [
    "Drafting your minutes...",
    "Structuring the summary...",
    "Building your outline...",
    "Piecing it together...",
    "Shaping your minutes...",
  ],
  [
    "Reviewing the draft...",
    "Checking for clarity...",
    "Double-checking notes...",
    "Polishing the summary...",
    "Making it clean...",
  ],
  [
    "Finalizing your minutes...",
    "Polishing the final version...",
    "Almost done!",
    "Wrapping things up...",
    "Preparing to deliver...",
  ],
];

const INTERVAL = 10000;

const TIPS = [
  "Did you know? Well-written minutes can cut your next meeting time by up to 30%.",
  "Strong meeting minutes are one of the top predictors of project success.",
  "Capturing action items clearly can boost team accountability by 45%.",
  "Teams with documented decisions move 23% faster on projects. Stay ahead!",
  "Consistent minutes help reduce post-meeting confusion by nearly half.",
  "Minutes aren't just notes—they're a roadmap to results.",
  "Every minute spent writing clear minutes saves 10 minutes of future meetings.",
  "Clear action items make follow-ups smoother and deadlines easier to hit.",
  "Documented meetings make onboarding new teammates faster and easier.",
  "Good minutes turn discussions into decisions and ideas into action.",
  "Decisions recorded in minutes are 60% more likely to be revisited and executed.",
  "Meetings without minutes risk losing up to 70% of discussed insights.",
  "Professional minutes help teams remember commitments—and deliver them.",
  "Effective meetings start with clear agendas and end with clear minutes.",
  "Sharing minutes within an hour increases team engagement significantly.",
  "Minutes aren’t just paperwork—they're proof of progress.",
  "Capturing key points during meetings creates momentum, not just memories.",
  "Organized minutes make leadership decisions faster and smarter.",
  "Clear records help resolve disagreements later—without drama.",
  "The best teams document, share, and act on their meetings. Be that team.",
];

interface AnimatedStatusTextProps {
  activeStep: number;
  isPaused?: boolean;
  pauseReason?: "insufficient_tokens" | "paused";
  useFinetuned?: boolean;
}

const FINETUNED_STATUS_VARIANTS: string[][] = [
  [
    "Processing your transcript...",
    "Preparing your data...",
    "Analyzing your meeting...",
    "Getting everything ready...",
  ],
  [
    "Generating your minutes...",
    "Creating professional minutes...",
    "Crafting your meeting minutes...",
    "Almost done with your minutes...",
  ],
];

export default function AnimatedStatusText({
  activeStep,
  isPaused = false,
  pauseReason,
  useFinetuned = false,
}: AnimatedStatusTextProps) {
  const variantSet = useFinetuned ? FINETUNED_STATUS_VARIANTS : STATUS_VARIANTS;

  const mappedStep = useFinetuned ? (activeStep < 2 ? 0 : 1) : activeStep;

  let variants = variantSet[mappedStep] || ["Working on your minutes..."];

  if (isPaused) {
    variants = ["Processing paused"];
  }
  const [idx, setIdx] = useState(0);
  const [tipIdx, setTipIdx] = useState(() => Math.floor(Math.random() * TIPS.length));

  useEffect(() => {
    setIdx(0);
    setTipIdx(Math.floor(Math.random() * TIPS.length));
  }, [activeStep]);

  const topUpMessage = "Please top up your account to and click on finish minutes to continue.";

  useEffect(() => {
    if (variants.length <= 1) {
      return;
    }
    const interval = setInterval(() => {
      setIdx((i) => {
        const nextIdx = (i + 1) % variants.length;
        setTipIdx(Math.floor(Math.random() * TIPS.length));
        return nextIdx;
      });
    }, INTERVAL);
    return () => clearInterval(interval);
  }, [variants.length]);

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={variants[idx] + TIPS[tipIdx]}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.5 }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        <Text fontSize="lg" fontWeight="medium" color="gray.700" textAlign="center">
          {variants[idx]}
        </Text>
        <Text fontSize="sm" color="gray.500" textAlign="center" mt={4} px={2}>
          {isPaused ? topUpMessage : TIPS[tipIdx]}
        </Text>
      </motion.div>
    </AnimatePresence>
  );
}
