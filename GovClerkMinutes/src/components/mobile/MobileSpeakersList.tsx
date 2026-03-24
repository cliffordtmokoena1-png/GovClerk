import React from "react";
import { Box, VStack, HStack, Text, Badge, Icon } from "@chakra-ui/react";
import { HiChevronRight } from "react-icons/hi2";
import { Speaker } from "@/lib/speakerLabeler";

type Props = {
  labelsToSpeaker: { [key: string]: Speaker };
  knownSpeakers: string[];
  onSpeakerClick: (speaker: Speaker, label: string) => void;
};

export default function MobileSpeakersList({
  labelsToSpeaker,
  knownSpeakers,
  onSpeakerClick,
}: Props) {
  const speakerEntries = Object.entries(labelsToSpeaker);

  if (speakerEntries.length === 0) {
    return (
      <Box p={6} textAlign="center">
        <Text color="gray.500" fontSize="sm">
          No speakers detected yet
        </Text>
      </Box>
    );
  }

  return (
    <VStack spacing={0} align="stretch" w="full">
      {speakerEntries.map(([label, speaker]) => {
        const isLabeled = speaker.uses > 0;

        return (
          <Box
            key={label}
            as="button"
            w="full"
            px={4}
            py={3}
            borderBottom="1px solid"
            borderColor="gray.100"
            _active={{ bg: "gray.50" }}
            onClick={() => onSpeakerClick(speaker, label)}
            textAlign="left"
          >
            <HStack spacing={3} justify="space-between">
              <VStack align="start" spacing={1} flex={1} minW={0}>
                <HStack spacing={2}>
                  <Text fontSize="md" fontWeight="medium" color="gray.900" isTruncated>
                    {speaker.name}
                  </Text>
                  {isLabeled && (
                    <Badge colorScheme="blue" fontSize="xs">
                      Labeled
                    </Badge>
                  )}
                </HStack>
                <Text fontSize="xs" color="gray.500">
                  Label: {label}
                </Text>
              </VStack>
              <Icon as={HiChevronRight} boxSize={5} color="gray.400" flexShrink={0} />
            </HStack>
          </Box>
        );
      })}
    </VStack>
  );
}
