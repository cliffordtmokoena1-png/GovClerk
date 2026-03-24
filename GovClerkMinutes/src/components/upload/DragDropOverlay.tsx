import React from "react";
import { Box, VStack, Heading, Text, Icon } from "@chakra-ui/react";
import { FiUpload } from "react-icons/fi";
import { DropzoneInputProps, DropzoneRootProps } from "react-dropzone";
import { LayoutConfig } from "@/hooks/useDropzoneLayout";

type DragDropOverlayProps = {
  config: LayoutConfig;
  getRootProps: () => DropzoneRootProps;
  getInputProps: () => DropzoneInputProps;
};

export default function DragDropOverlay({
  config,
  getRootProps,
  getInputProps,
}: DragDropOverlayProps) {
  return (
    <Box
      {...getRootProps()}
      w={config.container.width}
      h={config.container.height}
      minH={config.container.minHeight}
      bg={config.container.bg}
      borderWidth={config.container.borderWidth}
      borderStyle={config.container.borderStyle}
      borderColor={config.container.borderColor}
      borderRadius={config.container.borderRadius}
      p={config.container.padding}
      mx={config.container.margin}
      display="flex"
      alignItems="center"
      justifyContent="center"
      transition={config.container.transition}
      boxShadow={config.container.boxShadow}
      transform={config.container.transform}
      role="button"
      aria-label="Drop your media file here to upload"
      tabIndex={0}
    >
      <input {...getInputProps()} />
      <VStack spacing={6} textAlign="center">
        <Box
          p={config.icon.padding}
          bg={config.icon.bg}
          borderRadius="full"
          animation="bounce 1s infinite"
        >
          <Icon
            as={FiUpload}
            boxSize={config.icon.size}
            color={config.icon.color}
            aria-hidden="true"
          />
        </Box>

        <VStack spacing={3}>
          <Heading
            size={config.text.heading.size}
            color={config.text.heading.color}
            fontWeight="bold"
          >
            Drop it here!
          </Heading>
          <Text
            color={config.text.body.color}
            fontSize={config.text.body.fontSize}
            fontWeight="semibold"
          >
            Release to upload your media file
          </Text>
        </VStack>
      </VStack>
    </Box>
  );
}
