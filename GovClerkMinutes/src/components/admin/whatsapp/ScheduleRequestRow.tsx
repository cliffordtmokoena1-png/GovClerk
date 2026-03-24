import { Flex, Text, Tooltip, Code } from "@chakra-ui/react";
import { ScheduleRequest } from "../../../admin/whatsapp/types";
import { MdScheduleSend } from "react-icons/md";

type Props = {
  scheduleRequest: ScheduleRequest;
};

export default function ScheduleRequestRow({ scheduleRequest }: Props) {
  const dateObj = new Date(scheduleRequest.createdAt);
  const displayTimestamp = dateObj.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const fullTimestamp = dateObj.toString();

  return (
    <Flex
      direction={{ base: "column", md: "row" }}
      align="flex-start"
      gap={2}
      w="100%"
      minWidth={0}
      bg="yellow.50"
      borderRadius="md"
    >
      {/* Desktop Timestamp */}
      <Tooltip label={fullTimestamp} placement="top" hasArrow>
        <Text
          display={{ base: "none", md: "block" }}
          fontSize="xs"
          color="gray.400"
          textAlign="right"
          cursor="pointer"
          flexShrink={0}
          minW="70px"
          maxW="70px"
        >
          {displayTimestamp}
        </Text>
      </Tooltip>

      {/* Mobile Sender/Timestamp Row */}
      <Flex display={{ base: "flex", md: "none" }} direction="row" align="center" w="100%">
        <Flex align="center" fontWeight="semibold" color="orange.600" fontSize="xs" minW="0">
          <MdScheduleSend size={16} style={{ marginRight: 4 }} />
          Scheduled
        </Flex>
        <Tooltip label={fullTimestamp} placement="top" hasArrow>
          <Text fontSize="2xs" color="gray.400" ml={2} flexShrink={0}>
            {displayTimestamp}
          </Text>
        </Tooltip>
      </Flex>

      {/* Desktop Sender/Icon */}
      <Flex
        align="center"
        justify="flex-start"
        minW="110px"
        maxW="110px"
        flexShrink={0}
        display={{ base: "none", md: "flex" }}
      >
        <MdScheduleSend size={20} color="#DD6B20" style={{ marginRight: 6 }} />
        <Text
          fontWeight="semibold"
          color="orange.700"
          fontSize="sm"
          whiteSpace="nowrap"
          overflow="hidden"
          textOverflow="ellipsis"
        >
          Scheduled
        </Text>
      </Flex>

      {/* Main Content */}
      <Text
        fontSize={{ base: "sm", md: "md" }}
        wordBreak="break-word"
        flex="1"
        minWidth={0}
        pl={{ base: 0, md: 2 }}
      >
        Message scheduled for:{" "}
        <b>
          {new Date(scheduleRequest.sendAt).toLocaleString(undefined, {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}
        </b>{" "}
        (<Code>{scheduleRequest.templateId}</Code>)
      </Text>
    </Flex>
  );
}
