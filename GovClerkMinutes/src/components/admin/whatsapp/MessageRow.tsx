import { Flex, Text, Tooltip, Tag, TagLabel } from "@chakra-ui/react";
import { Message, Source } from "../../../admin/whatsapp/types";
import MessageStatus from "./MessageStatus";
import { Fragment } from "react";
import { MdPhone } from "react-icons/md";

type Props = {
  message: Message;
  source: Source;
};

export default function MessageRow({ message, source }: Props) {
  const dateObj = new Date(message.timestamp);
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
        <Text
          fontWeight="semibold"
          color={message.direction === "inbound" ? "blue.600" : "purple.600"}
          fontSize="xs"
          whiteSpace="nowrap"
          overflow="hidden"
          textOverflow="ellipsis"
        >
          {message.sender}
        </Text>
        <Tooltip label={fullTimestamp} placement="top" hasArrow>
          <Text fontSize="2xs" color="gray.400" ml={2} flexShrink={0}>
            {displayTimestamp}
          </Text>
        </Tooltip>
      </Flex>

      {/* Desktop Sender */}
      <Text
        display={{ base: "none", md: "block" }}
        fontWeight="semibold"
        color={message.direction === "inbound" ? "blue.600" : "purple.600"}
        textAlign="left"
        whiteSpace="nowrap"
        overflow="hidden"
        textOverflow="ellipsis"
        flexShrink={0}
        fontSize="sm"
        minW="110px"
        maxW="110px"
      >
        {message.sender}
      </Text>

      {/* Message Text */}
      <Flex direction="row" align="start" w="100%" gap={2}>
        {message.type === "call_permission_request" && (
          <Tag size="sm" colorScheme="green" flexShrink={0} mt={1}>
            <MdPhone style={{ marginRight: 4 }} />
            <TagLabel>Call permission requested</TagLabel>
          </Tag>
        )}
        <Text
          fontSize={{ base: "sm", md: "md" }}
          wordBreak="break-word"
          flex="1"
          minWidth={0}
          pl={{ base: 0, md: 2 }}
        >
          {message.text
            .trim()
            .split("\n")
            .map((line, index) => (
              <Fragment key={index}>
                <Text as="span">{line}</Text>
                <br />
              </Fragment>
            ))}
        </Text>
        <MessageStatus source={source} message={message} />
      </Flex>
    </Flex>
  );
}
