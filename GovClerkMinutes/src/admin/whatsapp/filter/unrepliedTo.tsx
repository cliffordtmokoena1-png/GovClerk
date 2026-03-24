import React from "react";
import { Tag, TagCloseButton, TagLabel } from "@chakra-ui/react";
import type { FilterDefinition } from "./types";

const UnrepliedTo: FilterDefinition<boolean> = {
  type: "unrepliedTo",
  addLabel: "Unreplied to",
  defaultValue: () => true,
  formatLabel: () => "Unreplied to",
  Pill: ({ onRemove }) => (
    <Tag
      size="lg"
      borderRadius="full"
      cursor="pointer"
      data-filter-pill
      onClick={(e) => e.stopPropagation()}
    >
      <TagLabel>Unreplied to</TagLabel>
      <TagCloseButton
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      />
    </Tag>
  ),
  Editor: () => null,
  toJSON: (v) => v,
  fromJSON: (raw) => Boolean(raw),
};

export default UnrepliedTo;
