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

const Phone: FilterDefinition<string> = {
  type: "phone",
  addLabel: "Phone number",
  defaultValue: () => "",
  formatLabel: (v) => (v ? `Phone: ${v}` : "Phone number"),
  Pill: ({ value, onRemove }) => (
    <Tag
      size="lg"
      borderRadius="full"
      cursor="pointer"
      data-filter-pill
      onClick={(e) => e.stopPropagation()}
    >
      <TagLabel>{value ? `Phone: ${value}` : "Phone number"}</TagLabel>
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
    useEffect(() => setText(value ?? ""), [value]);

    const debounced = useMemo(() => debounce((v: string) => onChange(v), 400), [onChange]);
    useEffect(() => () => debounced.cancel(), [debounced]);

    return (
      <PopoverContent w="sm" onClick={(e) => e.stopPropagation()}>
        <PopoverArrow />
        <PopoverBody>
          <HStack spacing={2}>
            <Text minW="120px">Phone</Text>
            <Input
              value={text}
              placeholder="e.g. 27686399038"
              onChange={(e) => {
                const v = e.target.value;
                setText(v);
                debounced(v);
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

export default Phone;
