import { Box, Text, VStack } from "@chakra-ui/react";
import React, { forwardRef, useEffect, useImperativeHandle, useState } from "react";

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export interface MentionListProps {
  items: string[];
  command: (item: string) => void;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
    return true;
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
    return true;
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
    return true;
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        return upHandler();
      }
      if (event.key === "ArrowDown") {
        return downHandler();
      }
      if (event.key === "Enter") {
        return enterHandler();
      }
      return false;
    },
  }));

  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor="gray.200"
      borderRadius="md"
      boxShadow="md"
      maxH="200px"
      overflowY="auto"
      p={2}
    >
      <VStack align="stretch" spacing={1}>
        {props.items.map((item, index) => (
          <Box
            key={index}
            bg={index === selectedIndex ? "blue.100" : "transparent"}
            p={2}
            borderRadius="md"
            cursor="pointer"
            onClick={() => selectItem(index)}
            _hover={{ bg: "blue.50" }}
          >
            <Text>{item}</Text>
          </Box>
        ))}
      </VStack>
    </Box>
  );
});

MentionList.displayName = "MentionList";
