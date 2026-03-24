import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  Text,
  Flex,
} from "@chakra-ui/react";
import { InfoOutlineIcon } from "@chakra-ui/icons";
import SpeakerItem from "./SpeakerItem";
export default function OrphanedPopover() {
  return (
    <Popover trigger="click" placement="auto" gutter={8}>
      <PopoverTrigger>
        <Flex
          align="center"
          fontSize="sm"
          bg="gray.50"
          borderRadius="full"
          px={3}
          py={1}
          border="1px solid"
          borderColor="gray.200"
          cursor="pointer"
          opacity={0.6}
          transition="all 0.2s ease"
        >
          <SpeakerItem speaker="Speaker" />
          <InfoOutlineIcon ml={2} />
        </Flex>
      </PopoverTrigger>

      <PopoverContent maxW="280px" bg="gray.50" color="black" fontSize="sm">
        <PopoverArrow bg="gray.50" />
        <PopoverBody>
          <Text fontSize="xs">
            This speaker cannot be labeled. We will still use the dialogue for your minutes.
          </Text>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
