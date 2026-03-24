import React, { useState, useCallback } from "react";
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  VStack,
  Text,
  Box,
  Button,
  Icon,
  HStack,
  useToast,
  List,
  ListItem,
  ListIcon,
  Progress,
} from "@chakra-ui/react";
import { HiCloudArrowUp, HiDocumentText, HiXMark } from "react-icons/hi2";
import { useDropzone } from "react-dropzone";
import { useAuth } from "@clerk/nextjs";
import { safeCapture } from "@/utils/safePosthog";
import { validateTemplateFiles, ACCEPTED_FILE_TYPES, MAX_FILES } from "@/utils/templateValidation";
import { serverUri } from "@/utils/server";
import { v4 as uuidv4 } from "uuid";
import {
  mapFilesToPresignRequest,
  uploadTemplateReferences,
  TemplatePresignResponse,
} from "@/utils/templateReferences";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onTemplateCreated?: () => void;
};

export default function MobileUploadTemplateDrawer({ isOpen, onClose, onTemplateCreated }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const toast = useToast();
  const { getToken } = useAuth();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setFiles((prev) => {
        const combined = [...prev, ...acceptedFiles];
        const { validFiles, rejectedNames, error } = validateTemplateFiles(combined);

        if (error) {
          toast({
            title: "Some files were skipped",
            description: error,
            status: "warning",
            duration: 5000,
            isClosable: true,
          });
        } else if (rejectedNames.length > 0) {
          toast({
            title: "Some files were skipped",
            description: `Skipped: ${rejectedNames.join(", ")}`,
            status: "warning",
            duration: 5000,
            isClosable: true,
          });
        }

        return validFiles.slice(0, MAX_FILES);
      });
    },
    [toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxFiles: MAX_FILES,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProcess = async () => {
    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please upload at least one template file",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setIsProcessing(true);
      setUploadProgress(0);

      const templateId = `custom-${uuidv4()}`;

      safeCapture("custom_template_process_started", {
        template_id: templateId,
        file_count: files.length,
        file_types: files.map((f) => f.type),
        platform: "mobile",
      });

      const presignResponse = await fetch("/api/templates/references/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          files: mapFilesToPresignRequest(files),
        }),
      });

      if (!presignResponse.ok) {
        const errorBody = (await presignResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorBody.error ?? "Failed to prepare template uploads");
      }

      const presignPayload = (await presignResponse.json()) as TemplatePresignResponse;

      await uploadTemplateReferences({
        files,
        references: presignPayload.references,
        onProgress: setUploadProgress,
      });

      const token = await getToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      const processResponse = await fetch(serverUri("/api/process-custom-template"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateId,
          region: presignPayload.region,
          references: presignPayload.references.map((reference) => ({
            key: reference.key,
            file_name: reference.fileName,
            content_type: reference.contentType,
          })),
        }),
      });

      if (!processResponse.ok) {
        const errorBody = (await processResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorBody.error ?? `Server error: ${processResponse.status}`);
      }

      const result = (await processResponse.json()) as { templateId: string; success: boolean };

      safeCapture("custom_template_processed", {
        template_id: result.templateId,
        file_count: files.length,
        platform: "mobile",
      });

      onTemplateCreated?.();

      toast({
        title: "Template created successfully!",
        description: "Your custom template is now selected and ready to use",
        status: "success",
        duration: 5000,
        isClosable: true,
      });

      onClose();
      setFiles([]);
      setUploadProgress(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      safeCapture("custom_template_process_failed", {
        error: errorMessage,
        file_count: files.length,
        platform: "mobile",
      });

      toast({
        title: "Failed to process template",
        description: errorMessage || "Please try again or contact support",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} placement="bottom" onClose={onClose} closeOnOverlayClick closeOnEsc>
      <DrawerOverlay />
      <DrawerContent borderTopRadius="2xl" pb={4} pt={2} maxH="90dvh">
        <DrawerCloseButton top={6} right={6} size="sm" />
        <DrawerHeader textAlign="center" fontSize="lg" fontWeight="semibold" pb={2}>
          <VStack spacing={2}>
            <Icon as={HiCloudArrowUp} boxSize={8} color="blue.500" />
            <Text>Upload Custom Template</Text>
          </VStack>
        </DrawerHeader>

        <DrawerBody px={4} pt={2} overflowY="auto">
          <VStack spacing={4} align="stretch">
            <Text fontSize="sm" color="gray.600" textAlign="center">
              Upload 1-10 sample meeting minutes files. Our AI will analyze them and create a custom
              template that matches your style.
            </Text>

            <Box
              {...getRootProps()}
              border="2px dashed"
              borderColor={isDragActive ? "blue.400" : "gray.300"}
              borderRadius="md"
              p={6}
              textAlign="center"
              cursor="pointer"
              transition="all 0.2s"
              bg={isDragActive ? "blue.50" : "gray.50"}
              _active={{ bg: "blue.100" }}
            >
              <input {...getInputProps()} />
              <VStack spacing={2}>
                <Icon as={HiCloudArrowUp} boxSize={10} color="gray.400" />
                <Text fontWeight="semibold" color="gray.700" fontSize="sm">
                  {isDragActive ? "Drop files here" : "Tap to select files"}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  PDF, TXT, DOC, DOCX
                </Text>
                <Text fontSize="xs" color="gray.400">
                  Max 10 files
                </Text>
              </VStack>
            </Box>

            {files.length > 0 && (
              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb={2} color="gray.700">
                  Selected Files ({files.length}/10)
                </Text>
                <List spacing={2}>
                  {files.map((file, index) => (
                    <ListItem
                      key={index}
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      p={2}
                      bg="gray.50"
                      borderRadius="md"
                    >
                      <HStack spacing={2} flex={1} minW={0}>
                        <ListIcon as={HiDocumentText} color="blue.500" />
                        <Text fontSize="sm" color="gray.700" isTruncated>
                          {file.name}
                        </Text>
                      </HStack>
                      <Icon
                        as={HiXMark}
                        boxSize={5}
                        color="gray.400"
                        cursor="pointer"
                        _active={{ color: "red.500" }}
                        onClick={() => removeFile(index)}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {isProcessing && (
              <Box>
                <Text fontSize="sm" mb={2} color="gray.700" textAlign="center">
                  Processing your templates...
                </Text>
                <Progress value={uploadProgress} size="sm" colorScheme="blue" borderRadius="full" />
              </Box>
            )}

            <Button
              colorScheme="blue"
              size="lg"
              onClick={handleProcess}
              isLoading={isProcessing}
              loadingText="Processing..."
              w="full"
              isDisabled={files.length === 0}
            >
              Process Template
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={onClose}
              w="full"
              isDisabled={isProcessing}
            >
              Cancel
            </Button>
          </VStack>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
