import React from "react";
import { Box, VStack, Heading, Text, Icon } from "@chakra-ui/react";
import { FiUpload, FiLock } from "react-icons/fi";
import { DropzoneInputProps, DropzoneRootProps } from "react-dropzone";
import { LayoutConfig } from "@/hooks/useDropzoneLayout";

type UploadCardProps = {
  config: LayoutConfig;
  getRootProps: () => DropzoneRootProps;
  getInputProps: () => DropzoneInputProps;
  disabled?: boolean;
};

export default function UploadCard({
  config,
  getRootProps,
  getInputProps,
  disabled,
}: UploadCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      // The dropzone will handle the file selection
    }
  };

  const rootProps = getRootProps();

  return (
    <Box
      {...(disabled ? {} : rootProps)}
      bg={disabled ? "gray.100" : config.container.bg}
      borderWidth={config.container.borderWidth}
      borderStyle={config.container.borderStyle}
      borderColor={disabled ? "gray.300" : config.container.borderColor}
      borderRadius={config.container.borderRadius}
      p={config.container.padding}
      w={config.container.width}
      h={config.container.height}
      minH={config.container.minHeight}
      cursor={disabled ? "not-allowed" : "pointer"}
      opacity={disabled ? 0.5 : 1}
      transition={config.container.transition}
      _hover={
        disabled
          ? {}
          : {
              bg: "blue.100",
              borderColor: "blue.500",
              transform: "translateY(-2px) scale(1.01)",
              boxShadow: "lg",
            }
      }
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      position="relative"
      role="button"
      aria-label={
        disabled
          ? "Upload disabled — insufficient tokens"
          : "Upload media file by dragging and dropping or clicking to browse"
      }
      aria-describedby="upload-instructions"
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
    >
      {!disabled && <input {...getInputProps()} />}

      <VStack spacing={config.spacing} textAlign="center">
        <Box
          p={config.icon.padding}
          bg={disabled ? "gray.200" : config.icon.bg}
          borderRadius="full"
          transition="all 0.2s"
        >
          <Icon
            as={disabled ? FiLock : FiUpload}
            boxSize={config.icon.size}
            color={disabled ? "gray.400" : config.icon.color}
            aria-hidden="true"
          />
        </Box>

        <VStack spacing={{ base: 2, md: 3 }}>
          <Heading
            size={config.text.heading.size}
            color={disabled ? "gray.400" : config.text.heading.color}
            fontWeight="bold"
          >
            Upload Media File
          </Heading>
          <Text
            color={disabled ? "gray.400" : config.text.body.color}
            fontSize={config.text.body.fontSize}
            textAlign="center"
            fontWeight="semibold"
          >
            {disabled ? (
              "Insufficient tokens"
            ) : config.text.body.content ? (
              <>
                <Text as="span" display={{ base: "inline", md: "none" }}>
                  {config.text.body.content.base}
                </Text>
                <Text as="span" display={{ base: "none", md: "inline" }}>
                  {config.text.body.content.md}
                </Text>
              </>
            ) : (
              "Drag and drop or click here"
            )}
          </Text>
          <Text
            color={disabled ? "gray.400" : config.text.subtitle.color}
            fontSize={config.text.subtitle.fontSize}
            textAlign="center"
            id="upload-instructions"
          >
            {disabled ? "Add tokens to enable upload" : "MP3, MP4, WAV, DOC, TXT, and more"}
          </Text>
        </VStack>
      </VStack>
    </Box>
  );
}
