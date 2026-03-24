import { Button, Menu, MenuButton, MenuItem, MenuList, Text, useToken } from "@chakra-ui/react";
import { safeCapture } from "@/utils/safePosthog";
import { useState } from "react";
import { FiChevronsRight } from "react-icons/fi";

type Props = {
  onPlaybackRateChange: (rate: number) => void;
};

export default function PlaybackRateControl({ onPlaybackRateChange }: Props) {
  const [playbackRate, setPlaybackRate] = useState(1);
  const [gray50] = useToken("colors", ["gray.50"]);

  const menuItems = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5];
  return (
    <Menu>
      <MenuButton
        as={Button}
        variant="ghost"
        size="sm"
        px={2}
        h="32px"
        minW="60px"
        bg={gray50}
        _hover={{ bg: "gray.100" }}
        _active={{ bg: "gray.100" }}
        rightIcon={<FiChevronsRight size={14} />}
      >
        <Text fontSize="sm" fontWeight="medium">
          {playbackRate}x
        </Text>
      </MenuButton>
      <MenuList minW="120px" shadow="lg" py={1}>
        {menuItems.map((rate) => (
          <MenuItem
            key={rate}
            fontSize="sm"
            py={1.5}
            px={3}
            bg={rate === playbackRate ? "gray.50" : undefined}
            onClick={() => {
              setPlaybackRate(rate);
              onPlaybackRateChange(rate);
              safeCapture("playback_rate_changed", {
                rate,
              });
            }}
          >
            {`${rate.toFixed(2)}x`}
          </MenuItem>
        ))}
      </MenuList>
    </Menu>
  );
}
