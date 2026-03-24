import { Flex, Box, Text } from "@chakra-ui/react";
import DatePicker from "react-datepicker";

import "react-datepicker/dist/react-datepicker.css";

type Props = {
  startDate: Date;
  endDate: Date;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
};

export default function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: Props) {
  return (
    <Flex gap={4} align="center" wrap="wrap" direction={{ base: "column", md: "row" }}>
      <Box w={{ base: "100%", md: "auto" }}>
        <Text fontWeight="bold" mb={1}>
          Start Date
        </Text>
        <DatePicker
          selected={startDate}
          onChange={(date) => date && onStartDateChange(date)}
          maxDate={endDate}
          showTimeSelect
          timeIntervals={1}
          dateFormat="yyyy-MM-dd HH:mm"
          wrapperClassName="datepicker-responsive"
        />
      </Box>
      <Box w={{ base: "100%", md: "auto" }}>
        <Text fontWeight="bold" mb={1}>
          End Date
        </Text>
        <DatePicker
          selected={endDate}
          onChange={(date) => date && onEndDateChange(date)}
          minDate={startDate}
          maxDate={new Date()}
          showTimeSelect
          timeIntervals={1}
          dateFormat="yyyy-MM-dd HH:mm"
          wrapperClassName="datepicker-responsive"
        />
      </Box>
    </Flex>
  );
}
