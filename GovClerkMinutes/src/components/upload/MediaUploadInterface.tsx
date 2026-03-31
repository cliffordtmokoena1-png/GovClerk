import React from "react";
import {
  Text,
  Spinner,
  VStack,
  Box,
  Grid,
  GridItem,
} from "@chakra-ui/react";
import { useDropzone } from "react-dropzone";
import { useDropzoneLayout } from "@/hooks/useDropzoneLayout";
import DragDropOverlay from "./DragDropOverlay";
import UploadCard from "./UploadCard";
import RecordingCard from "./RecordingCard";
import { LayoutKind } from "@/pages/dashboard/[[...slug]]";
import PwaInstallPrompt from "../PwaInstallPrompt";
import UpgradeRequiredWall from "@/components/paywall/UpgradeRequiredWall";

type Props = {
  isTransitioning: boolean;
  onDrop: (files: File[]) => Promise<void>;
  isSupported: boolean;
  layoutKind: LayoutKind;
  tokenBalance?: number | null;
  onUpgradeClick?: () => void;
};

export default function MediaUploadInterface({
  isTransitioning,
  onDrop,
  isSupported,
  layoutKind,
  tokenBalance,
  onUpgradeClick,
}: Props) {
  const isTokenInsufficient = tokenBalance != null && tokenBalance <= 0;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: isTokenInsufficient,
  });

  const layout = useDropzoneLayout({
    isDragActive: isTokenInsufficient ? false : isDragActive,
    recordingState: "idle",
  });

  if (isTransitioning) {
    return (
      <VStack w="full" h="full" justifyContent="center" alignItems="center" spacing={4}>
        <Spinner size="xl" color="blue.500" thickness="3px" />
        <Text color="gray.600" fontSize="md">
          Processing...
        </Text>
      </VStack>
    );
  }

  if (layout.type === "dragActive") {
    if (!isTokenInsufficient) {
      return (
        <DragDropOverlay
          config={layout.config}
          getRootProps={getRootProps}
          getInputProps={getInputProps}
        />
      );
    }
    // When tokens are insufficient, fall through to show the normal layout with the warning banner.
  }

  // After the guard above: if isTokenInsufficient caused us to fall through from dragActive,
  // we still have type === "dragActive" but we passed `isDragActive: false` to the hook
  // so this branch is unreachable in practice. The assertion satisfies TypeScript.
  if (layout.type !== "normal") {
    return null;
  }

  return (
    <Box
      w={{ base: "full", md: "2xl", lg: "4xl" }}
      maxW="100%"
      px={{ base: 4, md: 0 }}
      role="region"
      aria-label="Media upload interface"
    >
      {isTokenInsufficient && onUpgradeClick != null && (
        <UpgradeRequiredWall onUpgradeClick={onUpgradeClick} />
      )}

      {/* Mobile Layout */}
      <Box display={{ base: "block", md: "none" }} w="full">
        <VStack spacing={4} w="full">
          <PwaInstallPrompt />

          <UploadCard
            config={layout.uploadCard}
            getRootProps={getRootProps}
            getInputProps={getInputProps}
            disabled={isTokenInsufficient}
          />

          <RecordingCard
            config={layout.recordingCard}
            isSupported={isSupported}
            layoutKind={layoutKind}
            disabled={isTokenInsufficient}
          />
        </VStack>
      </Box>

      {/* Desktop / Tablet Layout */}
      <Box display={{ base: "none", md: "block" }} w="full">
        <Grid templateColumns="1fr 1fr" gap={{ md: 4, lg: 6 }} w="full">
          <GridItem>
            <UploadCard
              config={layout.uploadCard}
              getRootProps={getRootProps}
              getInputProps={getInputProps}
              disabled={isTokenInsufficient}
            />
          </GridItem>

          <GridItem>
            <RecordingCard
              config={layout.recordingCard}
              isSupported={isSupported}
              layoutKind={layoutKind}
              disabled={isTokenInsufficient}
            />
          </GridItem>
        </Grid>
      </Box>
    </Box>
  );
}
