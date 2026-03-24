import React from "react";
import { FormControl, FormLabel, Input, Text } from "@chakra-ui/react";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

type Props = {
  value: Date;
  onChange: (date: Date) => void;
  isRequired?: boolean;
  label?: string;
};

export default function DateTimeField({
  value,
  onChange,
  isRequired = false,
  label = "Select date & time",
}: Props) {
  const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneAbbr = new Date()
    .toLocaleTimeString("en-us", { timeZoneName: "short" })
    .split(" ")
    .pop();

  return (
    <FormControl id="datetime" isRequired={isRequired}>
      <FormLabel>{label}</FormLabel>
      <ReactDatePicker
        selected={value}
        onChange={(date) => date && onChange(date)}
        showTimeSelect
        timeIntervals={15}
        dateFormat="Pp"
        customInput={<Input />}
      />
      <Text fontSize="sm" mt={1} color="gray.500">
        Scheduled in &nbsp;
        <strong>
          {timezoneAbbr} ({timezoneName})
        </strong>
      </Text>
    </FormControl>
  );
}
