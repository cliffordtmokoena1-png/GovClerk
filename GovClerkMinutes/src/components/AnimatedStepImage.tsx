import { useEffect, useState } from "react";
import { Box } from "@chakra-ui/react";
import { AnimatePresence, motion } from "framer-motion";

const STEP_IMAGE_MAP: Record<number, string[]> = {
  0: ["/steps/step-robot-meeting.svg"],   // Transcribing your meeting...
  1: ["/steps/step-robot-workshop.svg"],  // Extracting key points...
  2: ["/steps/step-robot-notebook.svg"],  // Drafting your minutes...
  3: ["/steps/step-robot-meeting.svg"],   // Reviewing the draft...
  4: ["/steps/step-robot-notebook.svg"],  // Finalizing your minutes...
};

interface AnimatedStepImageProps {
  stepIndex: number;
  keyProp?: string | number;
  boxWidth?: string;
  isPaused?: boolean;
  pauseReason?: "insufficient_tokens" | "paused";
}

const ANIMATION_INTERVAL = 10000;

export default function AnimatedStepImage({
  stepIndex,
  keyProp,
  isPaused = false,
  pauseReason,
}: AnimatedStepImageProps) {
  // If paused, use the paused.svg image instead of the regular step images
  const images = isPaused ? ["/steps/paused.svg"] : STEP_IMAGE_MAP[stepIndex] || [];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
  }, [stepIndex]);

  useEffect(() => {
    // Don't animate when paused or when there's only one image
    if (images.length <= 1 || isPaused) {
      return;
    }
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % images.length);
    }, ANIMATION_INTERVAL);
    return () => clearInterval(interval);
  }, [images.length, isPaused]);

  const STANDARD_WIDTH = 300;
  const STANDARD_HEIGHT = 225;
  const MOBILE_SCALE = 0.7;

  return (
    <Box
      w={{ base: "100%", md: `${STANDARD_WIDTH}px` }}
      h={{ base: "auto", md: `${STANDARD_HEIGHT}px` }}
      maxW={{ base: `${STANDARD_WIDTH * MOBILE_SCALE}px`, md: `${STANDARD_WIDTH}px` }}
      p={{ base: 2, md: 4 }}
      mx="auto"
      mb={{ base: 3, md: 6 }}
      position="relative"
      overflow="hidden"
      bg={isPaused ? "yellow.50" : "white"}
      aspectRatio={{ base: `${STANDARD_WIDTH} / ${STANDARD_HEIGHT}`, md: "auto" }}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.img
          key={`${stepIndex}-${frame}`}
          src={images[frame]}
          alt="step illustration"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            position: "absolute",
            left: 0,
            top: 0,
            zIndex: 1,
            boxSizing: "border-box",
            background: "white",
          }}
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 60 }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
          draggable={false}
        />
      </AnimatePresence>
      <Box
        pointerEvents="none"
        position="absolute"
        left={0}
        top={0}
        w="40px"
        h="100%"
        zIndex={2}
        bgGradient="linear(to-r, white, transparent)"
      />
      <Box
        pointerEvents="none"
        position="absolute"
        right={0}
        top={0}
        w="40px"
        h="100%"
        zIndex={2}
        bgGradient="linear(to-l, white, transparent)"
      />
    </Box>
  );
}
