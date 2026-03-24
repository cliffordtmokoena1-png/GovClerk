import React from "react";
import {
  HStack,
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

const EndDate: FilterDefinition<Date> = {
  type: "endDate",
  addLabel: "End date",
  defaultValue: () => new Date(),
  formatLabel: (v) => `End: ${v.toLocaleDateString()}`,
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
          End at:&nbsp;
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
  Editor: ({ value, onChange }) => (
    <PopoverContent w="auto" onClick={(e) => e.stopPropagation()}>
      <PopoverArrow />
      <PopoverBody>
        <HStack>
          <Text minW="72px">End</Text>
          <DatePicker
            selected={value}
            onChange={(d) => d && onChange(d)}
            maxDate={new Date()}
            showTimeSelect
            timeIntervals={1}
            dateFormat="yyyy-MM-dd HH:mm"
            inline
          />
        </HStack>
      </PopoverBody>
    </PopoverContent>
  ),
  toJSON: (v) => v.toISOString(),
  fromJSON: (raw) => new Date(String(raw)),
};

export default EndDate;
