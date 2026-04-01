import React, { useEffect } from "react";
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

export default function MobileTemplateDetailDrawer({ isOpen, onClose, template }: Props) {
  const { downloadTemplate, isLoading, canDownload, showPaywall } = useTemplateDownload();
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
        platform: "mobile",
      });

      try {
        await setSetting("selected-template-id", template.id);
      } catch (firstError) {
        // Retry once after a short delay
        console.warn("Template selection failed, retrying...", firstError);
        await new Promise((r) => setTimeout(r, 800));
        await setSetting("selected-template-id", template.id);
      }

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
        platform: "mobile",
      });
    }
  }, [isOpen, template.id, template.name, template.category]);

  return (
    <Drawer isOpen={isOpen} placement="bottom" onClose={onClose} closeOnOverlayClick closeOnEsc>
      <DrawerOverlay />
      <DrawerContent borderTopRadius="2xl" pb={4} pt={2} maxH="85dvh">
        <DrawerCloseButton top={6} right={6} size="sm" />
        <DrawerHeader textAlign="center" fontSize="lg" fontWeight="semibold" pb={2}>
          <VStack spacing={2}>
            <Icon as={HiDocumentDuplicate} boxSize={8} color="blue.500" />
            <Text>{template.name}</Text>
            <Badge colorScheme="blue" fontSize="xs">
              {TEMPLATE_CATEGORIES[template.category]}
            </Badge>
          </VStack>
        </DrawerHeader>

        <DrawerBody px={4} pt={2} overflowY="auto">
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
                p={3}
                borderRadius="md"
                fontSize="xs"
                color="gray.700"
                maxH="200px"
                overflowY="auto"
                border="1px solid"
                borderColor="gray.200"
              >
                <TemplateMarkdownRenderer content={template.preview} variant="drawer" />
              </Box>
            </Box>

            {showPaywall && !canDownload && (
              <Alert status="warning" borderRadius="md">
                <AlertIcon />
                <AlertDescription fontSize="sm">
                  Subscribe to any plan to download templates and unlock all features.
                </AlertDescription>
              </Alert>
            )}

            <Button
              colorScheme={isSelected ? "green" : "blue"}
              size="lg"
              leftIcon={<Icon as={HiCheck} />}
              onClick={handleSelectTemplate}
              isLoading={isSelecting}
              loadingText="Selecting..."
              w="full"
              isDisabled={isSelected}
            >
              {isSelected ? "Selected" : "Select Template"}
            </Button>

            <Button
              variant="outline"
              colorScheme="blue"
              size="lg"
              leftIcon={<Icon as={HiArrowDownTray} />}
              onClick={() => downloadTemplate(template, onClose)}
              isLoading={isLoading}
              loadingText="Downloading..."
              w="full"
            >
              Download as Word
            </Button>

            {!canDownload && !showPaywall && (
              <Text fontSize="xs" color="gray.500" textAlign="center">
                Requires subscription
              </Text>
            )}
          </VStack>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
