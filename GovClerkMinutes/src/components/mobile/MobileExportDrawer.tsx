import React, { useState, useEffect } from "react";
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  VStack,
  Button,
  Text,
  Box,
  Image,
  Icon,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from "@chakra-ui/react";
import { FiCopy, FiChevronDown } from "react-icons/fi";
import { IconType } from "react-icons";
import { ApiGetMinutesResponseResult } from "@/components/Minutes";

type ExportOption = {
  label: string;
  handler: () => void;
  icon: string | IconType;
  isIconComponent?: boolean;
};

type ExportSection = {
  title: string;
  options: ExportOption[];
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCopyMinutes: () => void;
  onCopyTranscript: () => void;
  onExportMinutesDocx: () => void;
  onExportMinutesPdf: () => void;
  onExportTranscriptDocx: () => void;
  onExportTranscriptPdf: () => void;
  hideTranscript?: boolean;
  minutesData?: ApiGetMinutesResponseResult;
  selectedVersion?: number;
  onVersionChange?: (version: number) => void;
  contentType?: "Minutes" | "Agenda";
};

const ExportButton = ({ option, onClose }: { option: ExportOption; onClose: () => void }) => {
  const handleClick = () => {
    option.handler();
    onClose();
  };

  const leftIcon = option.isIconComponent ? (
    <Icon as={option.icon as IconType} boxSize={5} />
  ) : (
    <Box boxSize={5} display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
      <Image
        src={option.icon as string}
        alt={option.label}
        width={20}
        height={20}
        style={{ objectFit: "contain" }}
      />
    </Box>
  );

  return (
    <Button
      size="md"
      variant="ghost"
      justifyContent="flex-start"
      h="40px"
      onClick={handleClick}
      leftIcon={leftIcon}
    >
      {option.label}
    </Button>
  );
};

export default function MobileExportDrawer({
  isOpen,
  onClose,
  onCopyMinutes,
  onCopyTranscript,
  onExportMinutesDocx,
  onExportMinutesPdf,
  onExportTranscriptDocx,
  onExportTranscriptPdf,
  hideTranscript = false,
  minutesData,
  selectedVersion,
  onVersionChange,
  contentType = "Minutes",
}: Props) {
  const [localSelectedVersion, setLocalSelectedVersion] = useState<number>(0);

  useEffect(() => {
    if (minutesData?.minutes && minutesData.minutes.length > 1) {
      setLocalSelectedVersion(minutesData.minutes.length - 1);
    } else if (selectedVersion !== undefined) {
      setLocalSelectedVersion(selectedVersion);
    }
  }, [selectedVersion, minutesData?.minutes]);

  const handleVersionChange = (version: number) => {
    setLocalSelectedVersion(version);
    if (onVersionChange) {
      onVersionChange(version);
    }
  };
  const sections: ExportSection[] = [
    {
      title: contentType,
      options: [
        { label: "Export as Word", handler: onExportMinutesDocx, icon: "/word.svg" },
        { label: "Export as PDF", handler: onExportMinutesPdf, icon: "/pdf.svg" },
        {
          label: `Copy ${contentType.toLowerCase()}`,
          handler: onCopyMinutes,
          icon: FiCopy,
          isIconComponent: true,
        },
      ],
    },
  ];

  if (!hideTranscript) {
    sections.push({
      title: "Transcript",
      options: [
        { label: "Export as Word", handler: onExportTranscriptDocx, icon: "/word.svg" },
        { label: "Export as PDF", handler: onExportTranscriptPdf, icon: "/pdf.svg" },
        {
          label: "Copy transcript",
          handler: onCopyTranscript,
          icon: FiCopy,
          isIconComponent: true,
        },
      ],
    });
  }

  return (
    <Drawer isOpen={isOpen} placement="bottom" onClose={onClose} closeOnOverlayClick closeOnEsc>
      <DrawerOverlay />
      <DrawerContent borderTopRadius="2xl" pb={4} pt={2} maxH="80dvh">
        <DrawerCloseButton top={6} right={6} size="sm" />
        <DrawerHeader textAlign="center" fontSize="md" fontWeight="semibold" pb={2}>
          Export
        </DrawerHeader>
        <DrawerBody px={4} pt={2} overflowY="auto">
          <VStack spacing={4} align="stretch">
            {sections.map((section) => (
              <Box key={section.title}>
                <Text fontSize="sm" color="gray.600" mb={2} fontWeight="600">
                  {section.title}
                </Text>
                {section.title === contentType &&
                  minutesData?.minutes &&
                  minutesData.minutes.length > 1 && (
                    <Box mb={3}>
                      <Text fontSize="xs" color="gray.600" mb={1} fontWeight="500">
                        Select version
                      </Text>
                      <Menu placement="bottom" closeOnSelect gutter={0} matchWidth>
                        <MenuButton
                          as={Button}
                          rightIcon={<FiChevronDown />}
                          size="sm"
                          variant="outline"
                          width="full"
                          textAlign="left"
                          fontWeight="normal"
                          borderColor="gray.300"
                          bg="white"
                          h="32px"
                          px={3}
                        >
                          Version {localSelectedVersion + 1}
                        </MenuButton>
                        <MenuList minW="auto" maxW="100%">
                          {minutesData?.minutes?.map((_, index) => {
                            const isSelected = index === localSelectedVersion;
                            const isLatest = index === (minutesData?.minutes?.length ?? 0) - 1;
                            return (
                              <MenuItem
                                key={index}
                                onClick={() => handleVersionChange(index)}
                                bg={isSelected ? "gray.100" : "white"}
                                _hover={{ bg: "blue.50" }}
                              >
                                Version {index + 1}
                                {isLatest && " (latest)"}
                              </MenuItem>
                            );
                          })}
                        </MenuList>
                      </Menu>
                    </Box>
                  )}
                <VStack spacing={2} align="stretch">
                  {section.options.map((option) => (
                    <ExportButton key={option.label} option={option} onClose={onClose} />
                  ))}
                </VStack>
              </Box>
            ))}
          </VStack>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
