import React, { useEffect } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  VStack,
  Text,
  Box,
  Button,
  Icon,
  Badge,
  Divider,
  Alert,
  AlertIcon,
  AlertDescription,
  HStack,
  useToast,
} from "@chakra-ui/react";
import { HiDocumentDuplicate, HiArrowDownTray, HiCheck } from "react-icons/hi2";
import { Template, TEMPLATE_CATEGORIES } from "@/types/Template";
import { useTemplateDownload } from "@/hooks/useTemplateDownload";
import { TemplateMarkdownRenderer } from "@/components/TemplateMarkdownRenderer";
import { safeCapture } from "@/utils/safePosthog";
import { useSettings } from "@/hooks/useSettings";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  template: Template;
};

export default function DesktopTemplateDetailModal({ isOpen, onClose, template }: Props) {
  const { downloadTemplate, isLoading, showPaywall } = useTemplateDownload();
  const { settings, setSetting } = useSettings();
  const toast = useToast();
  const [isSelecting, setIsSelecting] = React.useState(false);

  const isSelected = settings?.["selected-template-id"] === template.id;

  const handleSelectTemplate = async () => {
    try {
      setIsSelecting(true);
      safeCapture("template_selected", {
        template_id: template.id,
        template_name: template.name,
        template_category: template.category,
        platform: "desktop",
      });

      await setSetting("selected-template-id", template.id);

      toast({
        title: "Template selected",
        description: `${template.name} is now your active template`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      onClose();
    } catch (error) {
      toast({
        title: "Failed to select template",
        description: "Please try again",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsSelecting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      safeCapture("template_detail_opened", {
        template_id: template.id,
        template_name: template.name,
        template_category: template.category,
        platform: "desktop",
      });
    }
  }, [isOpen, template.id, template.name, template.category]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" isCentered>
      <ModalOverlay />
      <ModalContent maxH="85vh">
        <ModalHeader>
          <HStack spacing={3}>
            <Icon as={HiDocumentDuplicate} boxSize={6} color="blue.500" />
            <VStack align="start" spacing={0} flex={1}>
              <Text fontSize="xl" fontWeight="bold">
                {template.name}
              </Text>
              <Badge colorScheme="blue" fontSize="xs" mt={1}>
                {TEMPLATE_CATEGORIES[template.category]}
              </Badge>
            </VStack>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody overflowY="auto">
          <VStack spacing={4} align="stretch">
            <Box>
              <Text fontSize="sm" fontWeight="semibold" color="gray.700" mb={2}>
                Description
              </Text>
              <Text fontSize="sm" color="gray.600">
                {template.description}
              </Text>
            </Box>

            <Divider />

            <Box>
              <Text fontSize="sm" fontWeight="semibold" color="gray.700" mb={2}>
                Best For
              </Text>
              <Text fontSize="sm" color="gray.600">
                {template.useCase}
              </Text>
            </Box>

            <Divider />

            <Box>
              <Text fontSize="sm" fontWeight="semibold" color="gray.700" mb={2}>
                Key Advantages
              </Text>
              <VStack align="stretch" spacing={2}>
                {template.advantages.map((advantage, index) => (
                  <HStack key={index} align="start" spacing={2}>
                    <Text fontSize="sm" color="blue.500" mt={0.5}>
                      •
                    </Text>
                    <Text fontSize="sm" color="gray.600" flex={1}>
                      {advantage}
                    </Text>
                  </HStack>
                ))}
              </VStack>
            </Box>

            <Divider />

            <Box>
              <Text fontSize="sm" fontWeight="semibold" color="gray.700" mb={2}>
                Template Preview
              </Text>
              <Box
                bg="gray.50"
                p={4}
                borderRadius="md"
                fontSize="sm"
                color="gray.700"
                maxH="300px"
                overflowY="auto"
                border="1px solid"
                borderColor="gray.200"
              >
                <TemplateMarkdownRenderer content={template.preview} variant="modal" />
              </Box>
            </Box>

            {showPaywall && (
              <Alert status="warning" borderRadius="md">
                <AlertIcon />
                <AlertDescription fontSize="sm">
                  Subscribe to any plan to download templates and unlock all features.
                </AlertDescription>
              </Alert>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <HStack spacing={3} w="full">
            <Button
              colorScheme={isSelected ? "green" : "blue"}
              leftIcon={<Icon as={HiCheck} />}
              onClick={handleSelectTemplate}
              isLoading={isSelecting}
              loadingText="Selecting..."
              flex={1}
              isDisabled={isSelected}
            >
              {isSelected ? "Selected" : "Select Template"}
            </Button>
            <Button
              variant="outline"
              colorScheme="blue"
              leftIcon={<Icon as={HiArrowDownTray} />}
              onClick={() => downloadTemplate(template, onClose)}
              isLoading={isLoading}
              loadingText="Downloading..."
              flex={1}
            >
              Download as Word
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
