import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertIcon,
  Box,
  Center,
  Flex,
  Spinner,
  Text,
  useDisclosure,
  Icon as ChakraIcon,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { HiPlus, HiCheckCircle } from "react-icons/hi2";
import { Template } from "@/types/Template";
import MobileTemplateDetailDrawer from "./MobileTemplateDetailDrawer";
import MobileUploadTemplateDrawer from "./MobileUploadTemplateDrawer";
import Icon from "../Icon";
import { BOTTOM_BAR_HEIGHT_PX } from "../BottomBar";
import { DocumentPreview } from "@/components/DocumentPreview";
import { useSettings } from "@/hooks/useSettings";
import { useTemplates } from "@/hooks/useTemplates";
import MobileTemplateActionsDrawer from "./MobileTemplateActionsDrawer";
import { useLongPress } from "@/hooks/useLongPress";
import { safeCapture } from "@/utils/safePosthog";

type TemplateListItemProps = {
  template: Template;
  isSelected: boolean;
  onOpenDetail: (template: Template) => void;
  onLongPress: (template: Template) => void;
  isDeleting: boolean;
};

const TemplateListItem = React.memo(function TemplateListItem({
  template,
  isSelected,
  onOpenDetail,
  onLongPress,
  isDeleting,
}: TemplateListItemProps) {
  const longPressHandlers = useLongPress(
    () => onLongPress(template),
    () => onOpenDetail(template),
    { delay: 500, preventDefault: false }
  );

  return (
    <Flex
      key={template.id}
      as="button"
      px={4}
      py={3}
      cursor="pointer"
      _active={{ bg: "gray.50" }}
      _focus={{ bg: "gray.50", outline: "2px solid", outlineColor: "blue.500" }}
      onClick={longPressHandlers.onClick}
      onTouchStart={(event) => {
        event.stopPropagation();
        longPressHandlers.onTouchStart(event);
      }}
      onTouchEnd={(event) => {
        event.stopPropagation();
        longPressHandlers.onTouchEnd(event);
      }}
      onTouchMove={(event) => {
        event.stopPropagation();
        longPressHandlers.onTouchMove(event);
      }}
      onMouseDown={(event) => {
        if (event.button === 0) {
          longPressHandlers.onMouseDown(event);
        }
      }}
      onMouseUp={longPressHandlers.onMouseUp}
      onMouseLeave={longPressHandlers.onMouseLeave}
      alignItems="center"
      gap={3}
      borderBottom="1px solid"
      borderColor="gray.100"
      borderLeft={isSelected ? "4px solid" : "none"}
      borderLeftColor={isSelected ? "blue.500" : undefined}
      w="full"
      textAlign="left"
      bg={isSelected ? "blue.50" : "transparent"}
      opacity={isDeleting ? 0.6 : 1}
      pointerEvents={isDeleting ? "none" : "auto"}
    >
      <Box
        flexShrink={0}
        w="60px"
        h="80px"
        bg="white"
        border="1px solid"
        borderColor={isSelected ? "blue.500" : "gray.300"}
        borderRadius="2px"
        overflow="hidden"
        position="relative"
        boxShadow={isSelected ? "0 2px 8px rgba(59, 130, 246, 0.25)" : "0 2px 4px rgba(0,0,0,0.1)"}
      >
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="linear-gradient(to bottom, #fafafa 0%, #ffffff 100%)"
        />

        <DocumentPreview content={template.preview} variant="thumbnail" />

        {isSelected && (
          <Box position="absolute" top={1} right={1} bg="blue.500" borderRadius="full" p={0.5}>
            <ChakraIcon as={HiCheckCircle} boxSize={4} color="white" />
          </Box>
        )}
      </Box>

      <Flex flexDirection="column" flex={1} minW={0} gap={1}>
        <Text
          fontSize="md"
          fontWeight="semibold"
          color={isSelected ? "blue.600" : "gray.900"}
          isTruncated
        >
          {template.name}
        </Text>
        <Text fontSize="sm" color="gray.500" noOfLines={2}>
          {template.description}
        </Text>
      </Flex>

      <Text fontSize="lg" color="gray.400" flexShrink={0}>
        ›
      </Text>
    </Flex>
  );
});

export default function MobileTemplatesScreen() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isUploadOpen, onOpen: onUploadOpen, onClose: onUploadClose } = useDisclosure();
  const { isOpen: isActionsOpen, onOpen: onActionsOpen, onClose: onActionsClose } = useDisclosure();
  const toast = useToast();
  const { settings, setSetting } = useSettings();
  const { templates, isLoading, error, mutate, deleteTemplate } = useTemplates();
  const [actionsTemplate, setActionsTemplate] = useState<Template | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleTemplateClick = useCallback(
    (template: Template) => {
      setSelectedTemplate(template);
      onOpen();
    },
    [onOpen]
  );

  const handleClose = () => {
    onClose();
    setSelectedTemplate(null);
  };

  const handleLongPress = useCallback(
    (template: Template) => {
      if (!template.isCustom) {
        return;
      }

      setActionsTemplate(template);
      onActionsOpen();
    },
    [onActionsOpen]
  );

  const handleDeleteTemplate = useCallback(async () => {
    if (!actionsTemplate) {
      return;
    }

    try {
      setDeletingId(actionsTemplate.id);
      safeCapture("custom_template_delete_clicked", {
        template_id: actionsTemplate.id,
        template_name: actionsTemplate.name,
        platform: "mobile",
      });

      await deleteTemplate(actionsTemplate.id);

      if (settings?.["selected-template-id"] === actionsTemplate.id) {
        await setSetting("selected-template-id", "GovClerkMinutes-template");
      }

      if (selectedTemplate?.id === actionsTemplate.id) {
        onClose();
        setSelectedTemplate(null);
      }

      toast({
        title: "Template deleted",
        description: `${actionsTemplate.name} has been removed`,
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
      onActionsClose();
      setActionsTemplate(null);
    }
  }, [
    actionsTemplate,
    deleteTemplate,
    onActionsClose,
    onClose,
    selectedTemplate,
    setSetting,
    settings,
    toast,
  ]);

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
  }, [onClose, selectedTemplate, templates]);

  const renderBody = useMemo(() => {
    if (isLoading) {
      return (
        <Center py={12}>
          <Spinner size="lg" />
        </Center>
      );
    }

    if (error) {
      return (
        <Alert status="error">
          <AlertIcon /> Failed to load templates. Please refresh.
        </Alert>
      );
    }

    if (templates.length === 0) {
      return (
        <Center py={12}>
          <VStack spacing={3}>
            <Text fontWeight="semibold" color="gray.700">
              No templates available yet
            </Text>
            <Text fontSize="sm" color="gray.500" textAlign="center">
              Upload your meeting samples to generate a custom template tailored to you.
            </Text>
          </VStack>
        </Center>
      );
    }

    return (
      <Box pb={`${BOTTOM_BAR_HEIGHT_PX + 20}px`}>
        {/* Upload Template Item */}
        <Flex
          as="button"
          px={4}
          py={3}
          cursor="pointer"
          _active={{ bg: "blue.50" }}
          _focus={{ bg: "blue.50", outline: "2px solid", outlineColor: "blue.500" }}
          onClick={onUploadOpen}
          alignItems="center"
          gap={3}
          borderBottom="1px solid"
          borderColor="gray.100"
          w="full"
          textAlign="left"
          bg="transparent"
        >
          <Box
            flexShrink={0}
            w="60px"
            h="80px"
            bg="white"
            border="2px dashed"
            borderColor="blue.400"
            borderRadius="2px"
            overflow="hidden"
            position="relative"
            boxShadow="0 2px 4px rgba(59, 130, 246, 0.15)"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <ChakraIcon as={HiPlus} boxSize={8} color="blue.500" />
          </Box>

          <Flex flexDirection="column" flex={1} minW={0} gap={1}>
            <Text fontSize="md" fontWeight="semibold" color="blue.600" isTruncated>
              Upload Template
            </Text>
            <Text fontSize="sm" color="gray.500" noOfLines={2}>
              Create custom template from your samples
            </Text>
          </Flex>

          <Text fontSize="lg" color="gray.400" flexShrink={0}>
            ›
          </Text>
        </Flex>

        {/* Library & Custom Templates */}
        {templates.map((template) => {
          const isSelected = settings?.["selected-template-id"] === template.id;
          const isDeleting = deletingId === template.id;

          return (
            <TemplateListItem
              key={template.id}
              template={template}
              isSelected={isSelected}
              onOpenDetail={handleTemplateClick}
              onLongPress={handleLongPress}
              isDeleting={isDeleting}
            />
          );
        })}
      </Box>
    );
  }, [
    deletingId,
    error,
    handleLongPress,
    handleTemplateClick,
    isLoading,
    onUploadOpen,
    settings,
    templates,
  ]);

  return (
    <>
      <Flex direction="column" h="100%" w="100%" bg="white" overflow="hidden">
        <Flex
          flexShrink={0}
          bg="white"
          borderBottom="1px solid"
          borderColor="gray.100"
          px={4}
          py={2}
          alignItems="center"
          minH="48px"
        >
          <Flex alignItems="center" gap={2.5} minW={0}>
            <Box w="20px" h="20px" flexShrink={0}>
              <Icon />
            </Box>
            <Text fontSize="md" fontWeight="medium" color="gray.700" isTruncated>
              Templates
            </Text>
          </Flex>
        </Flex>

        <Flex flexDir="column" overflowY="auto" overflowX="hidden" flex={1} minH={0} w="100%">
          {renderBody}
        </Flex>
      </Flex>

      {selectedTemplate && (
        <MobileTemplateDetailDrawer
          isOpen={isOpen}
          onClose={handleClose}
          template={selectedTemplate}
        />
      )}

      <MobileUploadTemplateDrawer
        isOpen={isUploadOpen}
        onClose={onUploadClose}
        onTemplateCreated={() => void mutate()}
      />

      <MobileTemplateActionsDrawer
        isOpen={isActionsOpen}
        onClose={() => {
          onActionsClose();
          setActionsTemplate(null);
        }}
        template={actionsTemplate}
        onDelete={handleDeleteTemplate}
      />
    </>
  );
}
