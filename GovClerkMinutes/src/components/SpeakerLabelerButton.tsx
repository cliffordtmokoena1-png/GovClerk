import { Button, Flex, Menu, MenuButton } from "@chakra-ui/react";
import { useCallback, useMemo } from "react";
import type { MouseEvent as ReactMouseEvent, RefObject } from "react";
import { RiArrowDropDownLine } from "react-icons/ri";
import OrphanedPopover from "./OrphanedPopover";
import SpeakerItem from "./SpeakerItem";
import { menuStateManager } from "@/utils/menuState";
import { Speaker, findIndexOfMatchingValue } from "@/lib/speakerLabeler";
type Props = {
  selectedLabel: string;
  variant: "button" | "text";
  isDisabled: boolean;
  defaultLabel?: string;
  segmentKey?: string;
  onMenuStateChange?: (key: string, isOpen: boolean) => void;
  onBeforeMenuOpen?: (key: string, buttonElement?: HTMLElement) => Promise<void> | void;
  labelsToSpeaker?: { [key: string]: Speaker };
};

export default function SpeakerLabelerButton({
  selectedLabel,
  defaultLabel,
  isDisabled,
  variant,
  segmentKey,
  onMenuStateChange,
  onBeforeMenuOpen,
  labelsToSpeaker = {},
  buttonRef,
}: Props & { buttonRef?: RefObject<HTMLDivElement> }) {
  const sortedSpeakers = useMemo(
    () => Object.entries(labelsToSpeaker).sort((a, b) => a[0].localeCompare(b[0])),
    [labelsToSpeaker]
  );

  const conditionalProps = useMemo(
    () =>
      variant === "button"
        ? {
            variant: "outline" as const,
            size: "sm" as const,
            bg: "gray.50",
            _hover: { bg: "gray.100" },
            _active: { bg: "gray.100" },
          }
        : {
            bg: "gray.50",
            borderRadius: "full",
            px: 3,
            py: 1,
            border: "1px solid",
            borderColor: "gray.200",
            transition: "all 0.2s ease",
            _hover: { bg: "gray.100", borderColor: "gray.300" },
          },
    [variant]
  );

  const selectedSpeakerData = labelsToSpeaker[selectedLabel];

  const speakerDisplayName = useMemo(() => {
    if (selectedSpeakerData?.uses && selectedSpeakerData.uses > 0) {
      return selectedSpeakerData.name;
    }

    if (defaultLabel) {
      return defaultLabel;
    }

    const fallbackIndex = findIndexOfMatchingValue(sortedSpeakers, selectedLabel);
    return `Speaker ${fallbackIndex + 1}`;
  }, [defaultLabel, selectedLabel, selectedSpeakerData, sortedSpeakers]);

  const speakerBadgeColor =
    selectedSpeakerData?.uses && selectedSpeakerData.uses > 0
      ? undefined
      : variant === "button"
        ? "green.300"
        : "gray.300";

  const handleMenuOpen = useCallback(
    async (event?: ReactMouseEvent<HTMLElement>) => {
      if (!segmentKey || menuStateManager.getMenuState(segmentKey)) {
        return;
      }

      if (onBeforeMenuOpen && event?.currentTarget) {
        await onBeforeMenuOpen(segmentKey, event.currentTarget as HTMLElement);
      }

      menuStateManager.setMenuState(segmentKey, true);
      onMenuStateChange?.(segmentKey, true);
    },
    [segmentKey, onBeforeMenuOpen, onMenuStateChange]
  );

  const handleMenuClose = useCallback(() => {
    if (!segmentKey || !menuStateManager.getMenuState(segmentKey)) {
      return;
    }

    menuStateManager.setMenuState(segmentKey, false);
    onMenuStateChange?.(segmentKey, false);
  }, [segmentKey, onMenuStateChange]);

  const handleButtonClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      event.stopPropagation();

      if (!segmentKey) {
        return;
      }

      if (menuStateManager.getMenuState(segmentKey)) {
        handleMenuClose();
      } else {
        void handleMenuOpen(event);
      }
    },
    [segmentKey, handleMenuClose, handleMenuOpen]
  );

  const isUnassigned = selectedLabel.startsWith("UNASSIGNED_");

  if (isUnassigned) {
    return <OrphanedPopover />;
  }

  return (
    <>
      <Menu isLazy onClose={handleMenuClose} closeOnSelect={false}>
        {() => {
          return (
            <>
              <MenuButton
                as={variant === "button" ? Button : Flex}
                {...conditionalProps}
                fontSize="sm"
                minW={variant === "button" ? 130 : 0}
                overflow="hidden"
                _focus={{ boxShadow: "none" }}
                _hover={variant === "button" ? { bg: "gray.200" } : {}}
                borderRadius={variant === "button" ? "md" : "full"}
                pointerEvents={isDisabled && variant === "text" ? "none" : "auto"}
                onClick={handleButtonClick}
                ref={buttonRef as any}
              >
                <Flex alignItems="center" ml={2}>
                  <SpeakerItem speaker={speakerDisplayName} bg={speakerBadgeColor} />
                  {variant !== "button" && <RiArrowDropDownLine size={20} />}
                </Flex>
              </MenuButton>
            </>
          );
        }}
      </Menu>
    </>
  );
}
