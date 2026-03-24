import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AlertIcon,
  Box,
  Center,
  Flex,
  Heading,
  Icon,
  IconButton,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
  useDisclosure,
  useToast,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  Button,
} from "@chakra-ui/react";
import type { FocusableElement } from "@chakra-ui/utils";
import { HiPlus, HiTrash } from "react-icons/hi2";
import { FaLayerGroup } from "react-icons/fa";
import { Template } from "@/types/Template";
import DesktopTemplateDetailModal from "./DesktopTemplateDetailModal";
import DesktopUploadTemplateModal from "./DesktopUploadTemplateModal";
import { DocumentPreview } from "@/components/DocumentPreview";
import { useSettings } from "@/hooks/useSettings";
import { useTemplates } from "@/hooks/useTemplates";
import { safeCapture } from "@/utils/safePosthog";
import HeroBanner from "@/components/shared/HeroBanner";
import ContentCard from "@/components/shared/ContentCard";

export default function DesktopTemplatesScreen() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isUploadOpen, onOpen: onUploadOpen, onClose: onUploadClose } = useDisclosure();
  const { isOpen: isConfirmOpen, onOpen: onConfirmOpen, onClose: onConfirmClose } = useDisclosure();
  const toast = useToast();
  const { settings, setSetting } = useSettings();
  const { templates, isLoading, error, mutate, deleteTemplate } = useTemplates();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const leastDestructiveRef = useRef<FocusableElement>(null!);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (cancelButtonRef.current) {
      leastDestructiveRef.current = cancelButtonRef.current;
    }
  }, [isConfirmOpen]);

  const handleTemplateClick = useCallback(
    (template: Template) => {
      setSelectedTemplate(template);
      onOpen();
    },
    [onOpen]
  );

  const requestDeleteTemplate = useCallback(
    (template: Template) => {
      if (!template.isCustom) {
        return;
      }
      setTemplateToDelete(template);
      onConfirmOpen();
    },
    [onConfirmOpen]
  );

  const handleDeleteTemplate = useCallback(async () => {
    if (!templateToDelete) {
      return;
    }

    const template = templateToDelete;

    try {
      setDeletingId(template.id);
      safeCapture("custom_template_delete_clicked", {
        template_id: template.id,
        template_name: template.name,
        platform: "desktop",
      });

      await deleteTemplate(template.id);

      if (settings?.["selected-template-id"] === template.id) {
        await setSetting("selected-template-id", "GovClerkMinutes-template");
      }

      if (selectedTemplate?.id === template.id) {
        onClose();
        setSelectedTemplate(null);
      }

      toast({
        title: "Template deleted",
        description: `${template.name} has been removed`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Failed to delete template",
        description: "Please try again",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setDeletingId(null);
      setTemplateToDelete(null);
      onConfirmClose();
    }
  }, [
    deleteTemplate,
    onClose,
    onConfirmClose,
    selectedTemplate,
    setSetting,
    settings,
    templateToDelete,
    toast,
  ]);

  const handleCancelDelete = useCallback(() => {
    onConfirmClose();
    setTemplateToDelete(null);
  }, [onConfirmClose]);

  const handleClose = () => {
    onClose();
    setSelectedTemplate(null);
  };

  useEffect(() => {
    if (!selectedTemplate || templates.length === 0) {
      return;
    }

    const updated = templates.find((template) => template.id === selectedTemplate.id);
    if (!updated) {
      onClose();
      setSelectedTemplate(null);
      return;
    }

    if (updated !== selectedTemplate) {
      setSelectedTemplate(updated);
    }
  }, [templates, selectedTemplate, onClose]);

  const renderTemplates = useMemo(() => {
    if (isLoading) {
      return (
        <Center py={16}>
          <Spinner size="lg" />
        </Center>
      );
    }

    if (error) {
      return (
        <Alert status="error">
          <AlertIcon />
          Failed to load templates. Please refresh the page.
        </Alert>
      );
    }

    if (templates.length === 0) {
      return (
        <Center py={16}>
          <VStack spacing={3}>
            <Heading size="sm">No templates available yet</Heading>
            <Text color="gray.600" fontSize="sm" textAlign="center">
              Upload your meeting samples to generate a custom template tailored to you.
            </Text>
          </VStack>
        </Center>
      );
    }

    return (
      <SimpleGrid columns={{ base: 2, md: 3, lg: 4, xl: 5, "2xl": 6 }} spacing={5}>
        {/* Upload Template Card */}
        <Box
          cursor="pointer"
          onClick={onUploadOpen}
          transition="all 0.2s"
          _hover={{ transform: "translateY(-2px)" }}
        >
          <Box
            position="relative"
            w="full"
            aspectRatio="8.5/11"
            bg="white"
            border="2px dashed"
            borderColor="blue.400"
            borderRadius="3px"
            overflow="hidden"
            boxShadow="0 2px 8px rgba(59, 130, 246, 0.15)"
            transition="all 0.2s"
            _hover={{ boxShadow: "0 4px 16px rgba(59, 130, 246, 0.25)", borderColor: "blue.500" }}
            mb={2}
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <VStack spacing={3}>
              <Icon as={HiPlus} boxSize={16} color="blue.500" />
              <Text fontSize="sm" fontWeight="semibold" color="blue.600">
                Upload Template
              </Text>
            </VStack>
          </Box>

          <VStack align="start" spacing={0.5}>
            <Text fontWeight="semibold" fontSize="xs" color="blue.600" noOfLines={1}>
              Custom Template
            </Text>
            <Text fontSize="2xs" color="gray.600" noOfLines={1}>
              Upload your own samples
            </Text>
          </VStack>
        </Box>

        {/* Library & Custom Templates */}
        {templates
          .slice()
          .sort((a, b) => {
            if (a.id === "GovClerkMinutes-template") {
              return -1;
            }
            if (b.id === "GovClerkMinutes-template") {
              return 1;
            }
            if (a.isCustom === b.isCustom) {
              return 0;
            }
            return a.isCustom ? 1 : -1;
          })
          .map((template) => {
            const isSelected = settings?.["selected-template-id"] === template.id;

            return (
              <Box
                key={template.id}
                cursor="pointer"
                onClick={() => handleTemplateClick(template)}
                transition="all 0.2s"
                _hover={{ transform: "translateY(-2px)" }}
              >
                <Box
                  position="relative"
                  w="full"
                  aspectRatio="8.5/11"
                  bg="white"
                  border={isSelected ? "2px solid" : "1px solid"}
                  borderColor={isSelected ? "blue.500" : "gray.300"}
                  borderRadius="3px"
                  overflow="hidden"
                  boxShadow={
                    isSelected ? "0 4px 16px rgba(59, 130, 246, 0.3)" : "0 2px 8px rgba(0,0,0,0.12)"
                  }
                  transition="all 0.2s"
                  _hover={{
                    boxShadow: isSelected
                      ? "0 6px 20px rgba(59, 130, 246, 0.4)"
                      : "0 4px 16px rgba(0,0,0,0.18)",
                  }}
                  mb={2}
                >
                  {isSelected && (
                    <Box
                      position="absolute"
                      top={0}
                      left={0}
                      right={0}
                      bg="blue.500"
                      color="white"
                      py={1}
                      textAlign="center"
                      fontSize="2xs"
                      fontWeight="semibold"
                      zIndex={10}
                      borderRadius={0}
                    >
                      Currently Selected
                    </Box>
                  )}
                  {template.isCustom && (
                    <IconButton
                      aria-label="Delete template"
                      icon={<Icon as={HiTrash} boxSize={4} />}
                      size="sm"
                      variant="solid"
                      colorScheme="red"
                      bg="white"
                      color="red.500"
                      border="1px solid"
                      borderColor="red.200"
                      boxShadow="sm"
                      _hover={{ bg: "red.50", color: "red.600", borderColor: "red.300" }}
                      _active={{ bg: "red.100" }}
                      position="absolute"
                      top={isSelected ? 7 : 2}
                      right={2}
                      zIndex={20}
                      onClick={(event) => {
                        event.stopPropagation();
                        requestDeleteTemplate(template);
                      }}
                      isLoading={deletingId === template.id}
                    />
                  )}
                  <Box
                    position="absolute"
                    top={0}
                    left={0}
                    right={0}
                    bottom={0}
                    bg="linear-gradient(to bottom, #fafafa 0%, #ffffff 100%)"
                  />

                  <DocumentPreview content={template.preview} variant="card" />

                  <Box
                    position="absolute"
                    bottom={0}
                    left={0}
                    right={0}
                    h="40px"
                    bgGradient="linear(to-t, rgba(255,255,255,0.9), transparent)"
                    pointerEvents="none"
                  />
                </Box>

                <VStack align="start" spacing={0.5}>
                  <Text fontWeight="semibold" fontSize="xs" color="gray.900" noOfLines={1}>
                    {template.name}
                  </Text>
                  <Text fontSize="2xs" color="gray.600" noOfLines={1}>
                    {template.description}
                  </Text>
                </VStack>
              </Box>
            );
          })}
      </SimpleGrid>
    );
  }, [
    deletingId,
    error,
    handleTemplateClick,
    isLoading,
    onUploadOpen,
    requestDeleteTemplate,
    settings,
    templates,
  ]);

  return (
    <>
      <Flex direction="column" w="full" bg="gray.50" minH="100%">
        <HeroBanner
          badge="CUSTOMIZABLE"
          heading="Meeting Templates"
          subtitle="Professional meeting minutes templates to streamline your workflow"
        />
        <Box maxW="5xl" mx="auto" w="full" px={{ base: 4, md: 6 }} py={{ base: 6, md: 8 }}>
          <ContentCard icon={FaLayerGroup} title="Templates">
            <Box p={6}>
              {renderTemplates}
            </Box>
          </ContentCard>
        </Box>
      </Flex>

      {selectedTemplate && (
        <DesktopTemplateDetailModal
          isOpen={isOpen}
          onClose={handleClose}
          template={selectedTemplate}
        />
      )}

      <DesktopUploadTemplateModal
        isOpen={isUploadOpen}
        onClose={onUploadClose}
        onTemplateCreated={() => void mutate()}
      />

      <AlertDialog
        isOpen={isConfirmOpen}
        onClose={handleCancelDelete}
        isCentered
        leastDestructiveRef={leastDestructiveRef}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete template
            </AlertDialogHeader>

            <AlertDialogBody>
              {`Are you sure you want to delete "${templateToDelete?.name ?? "this template"}"? This action cannot be undone.`}
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelButtonRef} onClick={handleCancelDelete} variant="ghost" autoFocus>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleDeleteTemplate}
                ml={3}
                isLoading={deletingId != null}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
