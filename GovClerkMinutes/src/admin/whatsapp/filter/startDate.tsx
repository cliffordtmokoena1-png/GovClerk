import React from "react";
import {
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  Tag,
  TagCloseButton,
  TagLabel,
  Text,
} from "@chakra-ui/react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import type { FilterDefinition } from "./types";

const StartDate: FilterDefinition<Date> = {
  type: "startDate",
  addLabel: "Start date",
  defaultValue: () => new Date(),
  formatLabel: (v) => `Start: ${v.toLocaleDateString()}`,
  // NOTE: no Popover here — just the trigger UI
  Pill: ({ value, onRemove }) => (
    <Tag
      size="lg"
      borderRadius="full"
      cursor="pointer"
      data-filter-pill
      onClick={(e) => e.stopPropagation()}
    >
      <TagLabel fontWeight="bold" suppressHydrationWarning>
        <Text as="span" fontWeight="normal">
          Start at:&nbsp;
        </Text>
        {`${value.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
        })}, ${value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}`}
      </TagLabel>
      <TagCloseButton
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      />
    </Tag>
  ),
  // Editor stays PopoverContent; FilterBar will wrap it with Popover
  Editor: ({ value, onChange }) => (
    <PopoverContent w="auto" onClick={(e) => e.stopPropagation()}>
      <PopoverArrow />
      <PopoverBody>
        <DatePicker
          selected={value}
          onChange={(d) => d && onChange(d)}
          showTimeSelect
          timeIntervals={1}
          dateFormat="yyyy-MM-dd HH:mm"
          inline
        />
      </PopoverBody>
    </PopoverContent>
  ),
  toJSON: (v) => v.toISOString(),
  fromJSON: (raw) => new Date(String(raw)),
};

export default StartDate;
