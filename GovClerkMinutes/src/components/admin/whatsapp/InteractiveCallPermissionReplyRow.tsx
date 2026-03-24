import { Flex, Text, Tooltip, Tag, TagLabel } from "@chakra-ui/react";
import type { Message, Source } from "../../../admin/whatsapp/types";
import MessageStatus from "./MessageStatus";
import { useEffect, useMemo, useState } from "react";
import { parseCallPermissionReplyText } from "@/admin/whatsapp/messages";
import { MdPhone } from "react-icons/md";

type Props = {
  message: Message;
  source: Source;
  messages: Message[];
};

// Renders a row for inbound interactive call permission replies with a live countdown to expiration.
export default function InteractiveCallPermissionReplyRow({ message, source, messages }: Props) {
  const dateObj = new Date(message.timestamp);
  const displayTimestamp = dateObj.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const fullTimestamp = dateObj.toString();

  // Parse structured JSON (v1). If invalid, parsed will be null.
  const parsedJson = useMemo(() => parseCallPermissionReplyText(message.text), [message.text]);
  const parsed = useMemo(() => {
    if (!parsedJson) {
      return null as null | { response: string; expiration?: number; contextId?: string };
    }
    const exp = parsedJson.expiration_timestamp;
    const expiration =
      typeof exp === "number"
        ? exp
        : typeof exp === "string" && /^\d+$/.test(exp)
          ? Number(exp)
          : undefined;
    const response = String(parsedJson.response || "").toLowerCase();
    const contextId = parsedJson.context_id ?? undefined;
    return { response, expiration, contextId };
  }, [parsedJson]);

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!parsed || !parsed.expiration) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [parsed]);

  const timeLeftLabel = useMemo(() => {
    if (!parsed || !parsed.expiration) {
      return null;
    }
    const msLeft = parsed.expiration * 1000 - now;
    if (msLeft <= 0) {
      return "expired";
    }
    const totalSecs = Math.floor(msLeft / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
    if (days > 0) {
      return `${days}d ${pad(hours)}h left`;
    }
    if (hours > 0) {
      return `${hours}h ${pad(minutes)}m left`;
    }
    return `${minutes}m left`;
  }, [parsed, now]);

  // Determine if this reply is stale: if there is a newer interactive_call_permission_reply
  // with the same context id in this conversation.
  const isStale = useMemo(() => {
    if (!parsed || !parsed.contextId) {
      return false;
    }
    const sameContextReplies = messages.filter((m) => {
      if (m.type !== "interactive_call_permission_reply" || typeof m.text !== "string") {
        return false;
      }
      const pj = parseCallPermissionReplyText(m.text);
      if (!pj) {
        return false;
      }
      return pj.context_id && pj.context_id === parsed.contextId;
    });
    if (sameContextReplies.length <= 1) {
      return false;
    }
    const latest = sameContextReplies.reduce((acc, cur) =>
      new Date(cur.timestamp).getTime() > new Date(acc.timestamp).getTime() ? cur : acc
    );
    return latest.messageId !== message.messageId; // if different and newer exists, current is stale
  }, [messages, parsed, message.messageId]);

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

      <Flex direction="row" align="start" w="100%" gap={2}>
        <Tag
          size="sm"
          colorScheme={!parsed ? "gray" : parsed.response === "accept" ? "green" : "red"}
          flexShrink={0}
          mt={1}
          title={timeLeftLabel || undefined}
        >
          <MdPhone style={{ marginRight: 4 }} />
          <TagLabel>
            {!parsed
              ? "Call permission"
              : parsed.response === "accept"
                ? "Permission accepted"
                : "Permission rejected"}
            {parsed && parsed.response === "accept" && timeLeftLabel ? ` • ${timeLeftLabel}` : ""}
          </TagLabel>
        </Tag>
        {isStale && (
          <Tag size="sm" colorScheme="gray" flexShrink={0} mt={1} title="A newer reply exists">
            <TagLabel>stale</TagLabel>
          </Tag>
        )}
        <MessageStatus source={source} message={message} />
      </Flex>
    </Flex>
  );
}
