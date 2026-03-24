import {
  Button,
  Menu,
  MenuButton,
  MenuGroup,
  MenuItem,
  MenuList,
  Flex,
  Text,
  useToken,
  Portal,
} from "@chakra-ui/react";
import SpeakerItem from "./SpeakerItem";
import { Speaker, findIndexOfMatchingValue } from "@/lib/speakerLabeler";
import { useState } from "react";
import { BsCheck } from "react-icons/bs";
import CircleIcon from "./CircleIcon";
import { colorFromString } from "@/utils/color";
import { FiFilter } from "react-icons/fi";

type Props = {
  sortedSpeakers: [string, Speaker][];
  labelsToSpeaker: { [label: string]: Speaker };
  onFilterSpeaker: (speaker: Speaker | undefined) => void;
};

export default function FilterSpeakersButton({
  sortedSpeakers,
  labelsToSpeaker,
  onFilterSpeaker,
}: Props) {
  const [selectedLabel, setSelectedLabel] = useState<string>();
  const [gray50] = useToken("colors", ["gray.50"]);

  return (
    <Menu>
      <MenuButton
        as={Button}
        variant="outline"
        size="sm"
        bg={gray50}
        _hover={{ bg: "gray.100" }}
        _active={{ bg: "gray.100" }}
        minW={{ base: "auto", md: "140px" }}
        _focus={{ boxShadow: "none" }}
        leftIcon={<FiFilter size={14} />}
        px={{ base: 0, sm: 3 }}
        pl={{ base: 2, sm: 3 }}
      >
        <Text fontSize="sm" fontWeight="medium" display={{ base: "none", sm: "block" }}>
          {selectedLabel ? labelsToSpeaker[selectedLabel].name : "All speakers"}
        </Text>
      </MenuButton>
      <Portal>
        <MenuList shadow="lg" zIndex={10} position="relative">
          <MenuGroup title="Filter by speaker">
            {sortedSpeakers.map(([speakerLabel, speakerData]) => (
              <MenuItem
                key={speakerLabel}
                onClick={() => {
                  if (speakerLabel === selectedLabel) {
                    setSelectedLabel(undefined);
                    onFilterSpeaker(undefined);
                  } else {
                    setSelectedLabel(speakerLabel);
                    onFilterSpeaker(speakerData);
                  }
                }}
                bg={selectedLabel === speakerLabel ? "gray.50" : undefined}
                py={2}
              >
                <Flex align="center" gap={2} w="full">
                  <CircleIcon
                    boxSize={3}
                    color={
                      speakerData.uses === 0
                        ? "gray.300"
                        : colorFromString(speakerData?.name || speakerLabel)
                    }
                  />
                  <Text fontSize="sm">
                    Speaker {findIndexOfMatchingValue(sortedSpeakers, speakerLabel) + 1}
                  </Text>
                  {speakerData.uses > 0 && (
                    <Text fontSize="xs" color="gray.500" ml="auto">
                      {speakerData.name}
                    </Text>
                  )}
                  {selectedLabel === speakerLabel && (
                    <BsCheck size={18} color="var(--chakra-colors-blue-500)" />
                  )}
                </Flex>
              </MenuItem>
            ))}
          </MenuGroup>
        </MenuList>
      </Portal>
    </Menu>
  );
}
