import {
  Box,
  Step,
  StepIndicator,
  StepSeparator,
  StepStatus,
  StepTitle,
  Stepper,
  useSteps,
  Text,
  Flex,
} from "@chakra-ui/react";
import { usePostHog } from "posthog-js/react";
import { motion } from "framer-motion";

export type StepProgress = {
  name: string;
  status: string;
};

interface MinutesProgressStepperProps {
  steps?: StepProgress[];
  isPaused?: boolean;
  pauseReason?: "insufficient_tokens" | "paused";
}

const getStepIndex = (steps?: StepProgress[]) => {
  if (!steps) {
    return 0;
  }
  const idx = steps.findIndex((s) => s.status !== "Success");
  return idx === -1 ? steps.length - 1 : idx;
};

import AnimatedStepImage from "./AnimatedStepImage";
import AnimatedStatusText from "./AnimatedStatusText";

const MinutesProgressStepper = ({
  steps,
  isPaused = false,
  pauseReason,
}: MinutesProgressStepperProps) => {
  const posthog = usePostHog();
  // Check if the finetuned model feature flag is enabled
  const useFinetuned = posthog?.isFeatureEnabled("mg-finetuned") ?? false;

  // Always use step 0 when paused, otherwise calculate normally
  const activeStep = isPaused ? 0 : getStepIndex(steps);

  // When using finetuned model, we only show 2 steps instead of 4
  const totalSteps = useFinetuned ? 2 : steps?.length || 5;

  return (
    <Box w="full" maxW="lg" p={{ base: 3, md: 6 }}>
      <AnimatedStepImage
        stepIndex={activeStep}
        keyProp={activeStep}
        isPaused={isPaused}
        pauseReason={pauseReason}
      />
      {/* Horizontal stepper lines */}
      <Box maxW="10rem" mx="auto" w="100%">
        <Flex
          justify="center"
          align="center"
          mt={{ base: 3, md: 6 }}
          mb={{ base: 2, md: 4 }}
          gap={0.5}
        >
          {Array(totalSteps)
            .fill(null)
            .map((_, idx) => {
              // For the finetuned model case, map the 4 backend steps to 2 UI steps
              // Step 0: Processing (maps to step 0-1 in backend)
              // Step 1: Generating minutes (maps to step 2-3 in backend)
              const stepIdx = idx;
              const backendIdx = useFinetuned ? (idx === 0 ? 0 : 3) : idx;
              const isComplete = steps?.[backendIdx]?.status === "Success";

              if (idx === activeStep) {
                return (
                  <motion.div
                    key={idx}
                    style={{
                      flex: 1,
                      height: "3px",
                      margin: "0 2px",
                      borderRadius: 0,
                      position: "relative",
                      overflow: "hidden",
                      background: isPaused ? "#ECC94B" : "#63b3ed", // Use yellow color when paused
                    }}
                  >
                    <motion.div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        height: "100%",
                        width: "100%",
                        background:
                          "linear-gradient(90deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0) 100%)",
                        borderRadius: 0,
                        pointerEvents: "none",
                      }}
                      initial={{ x: "0%", opacity: 0.7 }}
                      animate={{ x: ["0%", "100%"], opacity: 0.7 }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </motion.div>
                );
              } else if (isComplete) {
                return (
                  <Box
                    key={idx}
                    h="3px"
                    flex={1}
                    mx={0.5}
                    borderRadius={0}
                    bg="#38A169"
                    transition="background 0.2s"
                  />
                );
              } else {
                return (
                  <Box
                    key={idx}
                    h="3px"
                    flex={1}
                    mx={0.5}
                    borderRadius={0}
                    bg="gray.200"
                    transition="background 0.2s"
                  />
                );
              }
            })}
        </Flex>
      </Box>
      <AnimatedStatusText
        activeStep={activeStep}
        isPaused={isPaused}
        pauseReason={pauseReason}
        useFinetuned={useFinetuned}
      />
    </Box>
  );
};

export default MinutesProgressStepper;
