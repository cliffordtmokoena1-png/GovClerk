import {
  Box,
  Flex,
  Text,
  IconButton,
  Input,
  Spinner,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Button,
} from "@chakra-ui/react";
import React, { useState, useRef } from "react";
import { FiEdit2, FiChevronDown, FiCopy } from "react-icons/fi";
import Image from "next/image";
import { AgendaVersion } from "@/types/agenda";

export const AGENDA_TOP_BAR_HEIGHT_PX = 56;

type Props = Readonly<{
  agendaId?: number;
  title: string | null;
  status: string;
  lastSaved: Date | null;
  isSaving: boolean;
  onTitleUpdate: (newTitle: string) => Promise<void>;
  onCopy: (versionIndex?: number) => Promise<void> | void;
  onExportDocx: (versionIndex?: number) => Promise<void> | void;
  onExportPdf: (versionIndex?: number) => Promise<void> | void;
  isExporting?: boolean;
  canExport: boolean;
  versions?: AgendaVersion[];
  selectedVersion?: number;
}>;

export default function AgendaTopBar({
  agendaId,
  title,
  status,
  lastSaved,
  isSaving,
  onTitleUpdate,
  onCopy,
  onExportDocx,
  onExportPdf,
  isExporting = false,
  canExport,
  versions,
  selectedVersion,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [selectedExportVersion, setSelectedExportVersion] = useState<number | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (versions && versions.length > 1) {
      setSelectedExportVersion(versions.length - 1);
    } else {
      setSelectedExportVersion(selectedVersion);
    }
  }, [selectedVersion, versions]);

  const handleStartEdit = () => {
    setEditedTitle(title || "Untitled Agenda");
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const handleSaveTitle = async () => {
    if (!agendaId || !editedTitle.trim()) {
      setIsEditing(false);
      return;
    }

    try {
      await onTitleUpdate(editedTitle.trim());
    } catch (error) {
      console.error("Failed to update title:", error);
    }
    setIsEditing(false);
  };

  const getLastSavedText = () => {
    if (isSaving) {
      return "Saving...";
    }
    if (lastSaved) {
      const now = new Date();
      const diff = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);
      if (diff < 5) {
        return "Saved just now";
      }
      if (diff < 60) {
        return "Saved";
      }
      const minutes = Math.floor(diff / 60);
      if (minutes === 1) {
        return "Saved 1 min ago";
      }
      if (minutes < 60) {
        return `Saved ${minutes} mins ago`;
      }
      return "Saved";
    }
    return null;
  };

  return (
    <Box top={0} zIndex={1000} bg="white" w="full" borderBottom="1px" borderColor="gray.200">
      <Flex
        px={{ base: 2, md: 4 }}
        h={`${AGENDA_TOP_BAR_HEIGHT_PX}px`}
        alignItems="center"
        justifyContent="space-between"
        gap={{ base: 2, md: 4 }}
      >
        <Flex
          alignItems="center"
          gap={{ base: 1, md: 2 }}
          position="relative"
          flex={{ base: 1, md: "auto" }}
          justifyContent="flex-start"
          minW={0}
        >
          {isEditing ? (
            <Input
              ref={inputRef}
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveTitle();
                }
                if (e.key === "Escape") {
                  setIsEditing(false);
                }
              }}
              size="sm"
              width="auto"
              minW={{ base: "150px", md: "250px" }}
              maxW={{ base: "200px", md: "400px" }}
            />
          ) : (
            <>
              <Text
                fontSize={{ base: "sm", md: "md" }}
                fontWeight="medium"
                color="gray.700"
                isTruncated
                maxW={{ base: "150px", md: "350px" }}
              >
                {title || "Untitled Agenda"}
              </Text>
              <IconButton
                aria-label="Edit title"
                icon={<FiEdit2 size={12} />}
                variant="ghost"
                size="xs"
                onClick={handleStartEdit}
                opacity={1}
              />
            </>
          )}

          {status === "pending" && (
            <Flex alignItems="center" gap={1}>
              <Spinner size="xs" color="gray.500" />
            </Flex>
          )}

          {status === "generated" && (
            <>
              <Text fontSize="xs" color="gray.400" display={{ base: "none", md: "block" }}>
                •
              </Text>
              <Text fontSize="xs" color="gray.500" display={{ base: "none", md: "block" }}>
                {getLastSavedText()}
              </Text>
              {isSaving && <Spinner size="xs" color="gray.500" />}
            </>
          )}
        </Flex>

        <Flex
          flex={{ base: 0, md: "auto" }}
          justifyContent="flex-end"
          alignItems="center"
          gap={{ base: 1, md: 2 }}
          flexShrink={0}
        >
          <Menu placement="bottom-end" isLazy>
            <MenuButton
              as={Button}
              size="sm"
              colorScheme="blue"
              rightIcon={<FiChevronDown />}
              isDisabled={!canExport}
              isLoading={isExporting}
              px={{ base: 2, md: 4 }}
            >
              Export
            </MenuButton>
            <MenuList>
              {versions && versions.length > 1 && (
                <Box px={3} py={2}>
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
                      h="32px"
                      px={3}
                    >
                      Version {(selectedExportVersion ?? versions.length - 1) + 1}
                    </MenuButton>
                    <MenuList minW="auto" maxW="100%">
                      {versions.map((version, index) => {
                        const latestVersion = versions.length - 1;
                        const isSelected = index === (selectedExportVersion ?? latestVersion);
                        const isLatest = index === latestVersion;
                        return (
                          <MenuItem
                            key={`version-${version.id}-${index}`}
                            onClick={() => setSelectedExportVersion(index)}
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
              <MenuItem onClick={() => onExportDocx(selectedExportVersion)} isDisabled={!canExport}>
                <Flex alignItems="center" gap={2}>
                  <Box boxSize={4}>
                    <Image src="/word.svg" alt="Microsoft Word Logo" width={16} height={16} />
                  </Box>
                  Export agenda as Word
                </Flex>
              </MenuItem>
              <MenuItem onClick={() => onExportPdf(selectedExportVersion)} isDisabled={!canExport}>
                <Flex alignItems="center" gap={2}>
                  <Box boxSize={4}>
                    <Image src="/pdf.svg" alt="PDF Logo" width={16} height={16} />
                  </Box>
                  Export agenda as PDF
                </Flex>
              </MenuItem>
              <MenuItem onClick={() => onCopy(selectedExportVersion)} isDisabled={!canExport}>
                <Flex alignItems="center" gap={2}>
                  <FiCopy size={16} />
                  Copy agenda
                </Flex>
              </MenuItem>
            </MenuList>
          </Menu>
        </Flex>
      </Flex>
    </Box>
  );
}
