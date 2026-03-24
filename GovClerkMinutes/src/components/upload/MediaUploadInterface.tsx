import React from "react";
import {
  Text,
  Heading,
  Spinner,
  VStack,
  Box,
  Grid,
  GridItem,
  useBreakpointValue,
  Alert,
  AlertIcon,
  AlertDescription,
  Button,
} from "@chakra-ui/react";
import { useDropzone } from "react-dropzone";
import { useDropzoneLayout } from "@/hooks/useDropzoneLayout";
import DragDropOverlay from "./DragDropOverlay";
import UploadCard from "./UploadCard";
import RecordingCard from "./RecordingCard";
import { LayoutKind } from "@/pages/dashboard/[[...slug]]";
import PwaInstallPrompt from "../PwaInstallPrompt";

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
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;

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
      {!isMobile && (
        <VStack spacing={2} mb={{ base: 4, md: 6, lg: 8 }} textAlign="center">
          <Heading size={{ base: "md", md: "lg", lg: "xl" }} color="gray.700" fontWeight="bold">
            Get your minutes
          </Heading>
          <Text color="gray.600" fontSize={{ base: "sm", md: "md", lg: "lg" }}>
            Upload audio, video, or document files, or record directly to get started
          </Text>
        </VStack>
      )}

      {isTokenInsufficient && (
        <Alert
          status="warning"
          borderRadius="lg"
          mb={4}
          flexDirection="column"
          alignItems="flex-start"
          gap={2}
          py={4}
          px={4}
        >
          <AlertIcon />
          <AlertDescription fontSize="sm">
            <Text fontWeight="semibold" mb={1}>
              You don&apos;t have enough tokens to upload or record.
            </Text>
            <Text>Please upgrade your plan to continue.</Text>
          </AlertDescription>
          <Button size="sm" colorScheme="orange" mt={1} onClick={onUpgradeClick}>
            Upgrade Plan
          </Button>
        </Alert>
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
