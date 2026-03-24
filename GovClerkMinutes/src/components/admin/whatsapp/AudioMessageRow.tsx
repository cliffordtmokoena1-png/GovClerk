import { Flex, Text, Tooltip } from "@chakra-ui/react";
import { useMemo, useRef, useState } from "react";
import type H5AudioPlayer from "react-h5-audio-player";
import AudioPlayer from "@/components/AudioPlayer";
import { Message, Source } from "@/admin/whatsapp/types";
import MessageStatus from "./MessageStatus";

type Props = {
  message: Message;
  source: Source;
};

export default function AudioMessageRow({ message, source }: Props) {
  const dateObj = new Date(message.timestamp);
  const displayTimestamp = dateObj.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const fullTimestamp = dateObj.toString();

  // message.text contains the S3 key for the audio object
  const audioSrc = useMemo(() => {
    const key = encodeURIComponent(message.text.trim());
    return `/api/admin/get-whatsapp-file?key=${key}`;
  }, [message.text]);

  const audioPlayerRef = useRef<H5AudioPlayer | null>(null);
  const [, setDuration] = useState<number | undefined>(undefined);

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

      {/* Audio Player */}
      <Flex direction="row" align="start" w="100%" gap={2}>
        <Flex flex="1" minWidth={0} pl={{ base: 0, md: 2 }}>
          <AudioPlayer
            audioSrc={audioSrc}
            audioPlayerRef={audioPlayerRef}
            onDuration={(d) => setDuration(d)}
            onAudioLoadError={() => {
              // Nothing for now; could surface a toast
            }}
          />
        </Flex>
        <MessageStatus source={source} message={message} />
      </Flex>
    </Flex>
  );
}
