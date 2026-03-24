import React from "react";
import { Tag, TagCloseButton, TagLabel } from "@chakra-ui/react";
import type { FilterDefinition } from "./types";

const NeedsFollowup: FilterDefinition<boolean> = {
  type: "needsFollowup",
  addLabel: "Needs followup",
  defaultValue: () => true,
  formatLabel: () => "Needs followup",
  Pill: ({ onRemove }) => (
    <Tag
      size="lg"
      borderRadius="full"
      cursor="pointer"
      data-filter-pill
      onClick={(e) => e.stopPropagation()}
    >
      <TagLabel>Needs Followup</TagLabel>
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

export default NeedsFollowup;
