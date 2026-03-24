import {
  Text,
  Button,
  Flex,
  Heading,
  Menu,
  MenuButton,
  MenuGroup,
  MenuItem,
  MenuList,
  Divider,
  Progress,
  useToken,
  Portal,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
} from "@chakra-ui/react";
import { useMemo, useState, type ReactNode } from "react";
import SpeakerItem from "./SpeakerItem";
import FilterSpeakersButton from "./FilterSpeakersButton";
import { LayoutKind } from "@/pages/dashboard/[[...slug]]";
import CircleIcon from "./CircleIcon";
import { colorFromString } from "@/utils/color";
import { FiChevronDown } from "react-icons/fi";
import { Speaker, findIndexOfMatchingValue } from "@/lib/speakerLabeler";
import { SpeakerLabelerContent } from "@/components/meetings/SpeakerLabeler";

const MENU_SCROLLBAR_CSS = {
  "&::-webkit-scrollbar": {
    width: "4px",
  },
  "&::-webkit-scrollbar-track": {
    background: "transparent",
  },
  "&::-webkit-scrollbar-thumb": {
    background: "#CBD5E0",
    borderRadius: "2px",
  },
  "&::-webkit-scrollbar-thumb:hover": {
    background: "#A0AEC0",
  },
} as const;

type Props = {
  selectedLabel: string;
  setSelectedLabel: (label: string) => void;
  onFilterSpeaker: (speaker: Speaker | undefined) => void;
  layoutKind: LayoutKind;
  labelsToSpeaker: { [key: string]: Speaker };
  knownSpeakers: string[];
  triggerSpeakerLabel: (speaker: Speaker, selectedLabel: string) => void;
};

export default function SpeakerLabeler({
  selectedLabel,
  setSelectedLabel,
  onFilterSpeaker,
  layoutKind,
  labelsToSpeaker,
  knownSpeakers,
  triggerSpeakerLabel,
}: Props) {
  const [gray50] = useToken("colors", ["gray.50"]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [userInputName, setUserInputName] = useState("");

  const sortedSpeakers = useMemo(
    () => Object.entries(labelsToSpeaker).sort((a, b) => a[0].localeCompare(b[0])),
    [labelsToSpeaker]
  );

  const selectedSpeakerIndex = useMemo(
    () => findIndexOfMatchingValue(sortedSpeakers, selectedLabel),
    [sortedSpeakers, selectedLabel]
  );

  const { labeledCount, totalCount, progressPercent } = useMemo(() => {
    const speakerValues = Object.values(labelsToSpeaker);
    const total = speakerValues.length;

    if (total === 0) {
      return {
        labeledCount: 0,
        totalCount: 0,
        progressPercent: 0,
      };
    }

    const labeled = speakerValues.reduce(
      (count, speakerData) => (speakerData.uses > 0 ? count + 1 : count),
      0
    );

    return {
      labeledCount: labeled,
      totalCount: total,
      progressPercent: (labeled / total) * 100,
    };
  }, [labelsToSpeaker]);

  const displaySpeakerNumber = selectedSpeakerIndex + 1;

  const handleSpeakerLabeled = (name: string) => {
    const speaker = labelsToSpeaker[selectedLabel];
    if (!speaker) {
      return;
    }

    const updatedSpeaker: Speaker = {
      ...speaker,
      name,
      uses: speaker.uses + 1,
    };

    triggerSpeakerLabel(updatedSpeaker, selectedLabel);
    setUserInputName("");
    setIsPopoverOpen(false);
  };

  const handlePopoverClose = () => {
    setIsPopoverOpen(false);
    setUserInputName("");
  };

  return (
    <Flex
      w="full"
      direction="column"
      pt={3}
      pb={4}
      px={4}
      bg="white"
      borderBottom="1px solid"
      borderColor="gray.100"
      transition="all 0.2s"
      position="relative"
      h={layoutKind === "desktop" ? "80px" : "auto"}
    >
      <Flex justify="space-between" align="center" mb={2}>
        <Heading size="xs" color="gray.700">
          Label Speakers
        </Heading>
        <Flex align="center" gap={2}>
          <Text fontSize="xs" color="gray.500" fontWeight="medium">
            {labeledCount} of {totalCount} labeled
          </Text>
          <Progress
            value={progressPercent}
            size="xs"
            width="60px"
            borderRadius="full"
            colorScheme="blue"
            bg="gray.100"
          />
        </Flex>
      </Flex>

      <Flex flexDir="row" gap={2} w="full" align="center" justify="space-between">
        <Flex flex={1} gap={2} align="center">
          <Menu>
            <MenuButton
              as={Button}
              variant="outline"
              size="sm"
              minW="140px"
              rightIcon={<FiChevronDown />}
              bg={gray50}
              _hover={{ bg: "gray.100" }}
              _active={{ bg: "gray.100" }}
            >
              <Flex align="center" gap={2}>
                <CircleIcon
                  boxSize={3}
                  color={
                    labelsToSpeaker[selectedLabel]?.uses === 0
                      ? "gray.300"
                      : colorFromString(labelsToSpeaker[selectedLabel]?.name || selectedLabel)
                  }
                />
                <Text fontSize="sm" fontWeight="medium">
                  Speaker {displaySpeakerNumber}
                </Text>
              </Flex>
            </MenuButton>
            <Portal>
              <ScrollableMenuList>
                <MenuGroup title="Detected Speakers:">
                  {sortedSpeakers.map(([speakerLabel, speakerData], index) => (
                    <MenuItem
                      key={speakerLabel}
                      onClick={() => setSelectedLabel(speakerLabel)}
                      bg={selectedLabel === speakerLabel ? "gray.50" : undefined}
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
                        <Text fontSize="sm">Speaker {index + 1}</Text>
                        {speakerData.uses > 0 && (
                          <Text fontSize="xs" color="gray.500" ml="auto">
                            {speakerData.name}
                          </Text>
                        )}
                      </Flex>
                    </MenuItem>
                  ))}
                </MenuGroup>
              </ScrollableMenuList>
            </Portal>
          </Menu>

          <Text fontSize="sm" fontWeight="medium" color="gray.600" alignSelf="center">
            is
          </Text>

          <Popover
            isOpen={isPopoverOpen}
            onClose={handlePopoverClose}
            placement="bottom-start"
            closeOnBlur
          >
            <PopoverTrigger>
              <Button
                key={selectedLabel}
                variant="outline"
                size="sm"
                minW="140px"
                rightIcon={<FiChevronDown />}
                bg={gray50}
                _hover={{ bg: "gray.100" }}
                _active={{ bg: "gray.100" }}
                onClick={() => setIsPopoverOpen(!isPopoverOpen)}
              >
                <Flex align="center" gap={2}>
                  <SpeakerItem
                    speaker={
                      labelsToSpeaker[selectedLabel]?.uses > 0
                        ? labelsToSpeaker[selectedLabel].name
                        : "Assign name"
                    }
                    bg={labelsToSpeaker[selectedLabel]?.uses > 0 ? undefined : "green.300"}
                  />
                </Flex>
              </Button>
            </PopoverTrigger>
            <Portal>
              <PopoverContent
                shadow="lg"
                borderRadius="xl"
                border="1px solid"
                borderColor="gray.200"
                minW="320px"
                maxW="400px"
                _focus={{ outline: "none" }}
              >
                <PopoverBody p={0}>
                  <SpeakerLabelerContent
                    labelsToSpeaker={labelsToSpeaker}
                    knownSpeakers={knownSpeakers}
                    selectedLabel={selectedLabel}
                    sortedSpeakers={sortedSpeakers}
                    onSpeakerLabeled={handleSpeakerLabeled}
                    menuOnClose={handlePopoverClose}
                    userInputName={userInputName}
                    setUserInputName={setUserInputName}
                    isDesktop
                    hideCurrentlyEditing
                  />
                </PopoverBody>
              </PopoverContent>
            </Portal>
          </Popover>
        </Flex>

        <Flex gap={2} align="center">
          {layoutKind === "desktop" && <Divider orientation="vertical" h="24px" />}
          <FilterSpeakersButton
            sortedSpeakers={sortedSpeakers}
            labelsToSpeaker={labelsToSpeaker}
            onFilterSpeaker={onFilterSpeaker}
          />
        </Flex>
      </Flex>
    </Flex>
  );
}

function ScrollableMenuList({ children }: { children: ReactNode }) {
  return (
    <MenuList
      shadow="lg"
      zIndex={10}
      position="relative"
      maxH="300px"
      overflowY="auto"
      css={MENU_SCROLLBAR_CSS}
    >
      {children}
    </MenuList>
  );
}
