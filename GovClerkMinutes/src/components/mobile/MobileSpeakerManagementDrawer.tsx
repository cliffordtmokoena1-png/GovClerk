import React, { useState } from "react";
import {
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Box,
  Badge,
} from "@chakra-ui/react";
import { Speaker } from "@/lib/speakerLabeler";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  speaker: Speaker | null;
  currentLabel: string;
  knownSpeakers: string[];
  onLabelSpeaker: (speaker: Speaker, newName: string) => void;
};

export default function MobileSpeakerManagementDrawer({
  isOpen,
  onClose,
  speaker,
  currentLabel,
  knownSpeakers,
  onLabelSpeaker,
}: Props) {
  const [customName, setCustomName] = useState("");

  if (!speaker) {
    return null;
  }

  const handleLabelSpeaker = (newName: string) => {
    onLabelSpeaker(speaker, newName);
    setCustomName("");
    onClose();
  };

  return (
    <Drawer isOpen={isOpen} placement="bottom" onClose={onClose} closeOnOverlayClick closeOnEsc>
      <DrawerOverlay />
      <DrawerContent borderTopRadius="2xl" pb={4} pt={2} maxH="80dvh">
        <DrawerCloseButton top={6} right={6} size="sm" />
        <DrawerHeader textAlign="center" fontSize="md" fontWeight="semibold" pb={2}>
          Label Speaker
        </DrawerHeader>
        <DrawerBody px={4} pt={2} overflowY="auto">
          <VStack spacing={4} align="stretch">
            <Box>
              <Text fontSize="sm" color="gray.600" mb={2}>
                Enter Custom Name
              </Text>
              <HStack>
                <Input
                  placeholder="e.g., John Smith"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  size="md"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customName.trim()) {
                      handleLabelSpeaker(customName.trim());
                    }
                  }}
                />
                <Button
                  colorScheme="blue"
                  size="md"
                  isDisabled={!customName.trim()}
                  onClick={() => handleLabelSpeaker(customName.trim())}
                  flexShrink={0}
                >
                  Save
                </Button>
              </HStack>
            </Box>

            {knownSpeakers.length > 0 && (
              <Box>
                <Text fontSize="sm" color="gray.600" mb={2}>
                  Or Select from Known Speakers
                </Text>
                <VStack spacing={2} align="stretch">
                  {knownSpeakers.map((knownSpeaker) => (
                    <Button
                      key={knownSpeaker}
                      variant="outline"
                      size="md"
                      justifyContent="flex-start"
                      onClick={() => handleLabelSpeaker(knownSpeaker)}
                      isDisabled={speaker.name === knownSpeaker}
                      h="40px"
                    >
                      {knownSpeaker}
                    </Button>
                  ))}
                </VStack>
              </Box>
            )}
          </VStack>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
