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

// Recurring due date anchor day-of-month (or exact date) to match lead's schedule cadence
const RecurringDueOn: FilterDefinition<Date> = {
  type: "recurringDueOn",
  addLabel: "Recurring due date on",
  defaultValue: () => new Date(),
  formatLabel: (v) => `Recurring due date on: ${v.toLocaleDateString()}`,
  Pill: ({ value, onRemove }) => (
    <Tag
      size="lg"
      borderRadius="full"
      cursor="pointer"
      data-filter-pill
      onClick={(e) => e.stopPropagation()}
    >
      <TagLabel fontWeight="bold">
        <Text as="span" fontWeight="normal">
          Recurring from:&nbsp;
        </Text>
        {value.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
        })}
      </TagLabel>
      <TagCloseButton
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      />
    </Tag>
  ),
  Editor: ({ value, onChange }) => (
    <PopoverContent w="auto" onClick={(e) => e.stopPropagation()}>
      <PopoverArrow />
      <PopoverBody>
        <DatePicker selected={value} onChange={(d) => d && onChange(d)} inline />
      </PopoverBody>
    </PopoverContent>
  ),
  toJSON: (v) => v.toISOString(),
  fromJSON: (raw) => new Date(String(raw)),
};

export default RecurringDueOn;
