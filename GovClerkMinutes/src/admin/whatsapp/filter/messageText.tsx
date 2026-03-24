import React, { useEffect, useMemo, useState } from "react";
import {
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  Tag,
  TagCloseButton,
  TagLabel,
  Input,
  HStack,
  Text,
} from "@chakra-ui/react";
import type { FilterDefinition } from "./types";
import { debounce } from "@/utils/debounce";

const MessageText: FilterDefinition<string> = {
  type: "messageText",
  addLabel: "Text contains",
  defaultValue: () => "",
  formatLabel: (v) => (v ? `Text contains "${v}"` : "Text contains"),
  Pill: ({ value, onRemove }) => (
    <Tag
      size="lg"
      borderRadius="full"
      cursor="pointer"
      data-filter-pill
      onClick={(e) => e.stopPropagation()}
    >
      <TagLabel>{value ? `Text contains "${value}"` : "Text contains"}</TagLabel>
      <TagCloseButton
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      />
    </Tag>
  ),
  Editor: ({ value, onChange }) => {
    const [text, setText] = useState<string>(value ?? "");
    useEffect(() => {
      setText(value ?? "");
    }, [value]);

    const debounced = useMemo(() => debounce((v: string) => onChange(v), 500), [onChange]);
    useEffect(() => () => debounced.cancel(), [debounced]);

    return (
      <PopoverContent w="sm" onClick={(e) => e.stopPropagation()}>
        <PopoverArrow />
        <PopoverBody>
          <HStack spacing={2}>
            <Text minW="120px">Text contains</Text>
            <Input
              value={text}
              placeholder="Exact match text"
              onChange={(e) => {
                const v = e.target.value;
                setText(v);
                if (v.trim() !== "") {
                  debounced(v);
                }
              }}
              autoFocus
            />
          </HStack>
        </PopoverBody>
      </PopoverContent>
    );
  },
  toJSON: (v) => v,
  fromJSON: (raw) => String(raw ?? ""),
};

export default MessageText;
