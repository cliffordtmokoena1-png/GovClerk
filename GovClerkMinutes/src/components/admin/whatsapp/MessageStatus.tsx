import React from "react";
import { Text, Tooltip } from "@chakra-ui/react";
import type { Message, Source } from "@/admin/whatsapp/types";

type Props = {
  source: Source;
  message: Message;
};

export default function MessageStatus({ source, message }: Props) {
  // We only know status for in house whatsapp tool
  if (source !== "whatsapp") {
    return null;
  }

  const formatTimestamp = (ts: string | null | undefined): string =>
    ts ? new Date(ts).toLocaleString() : "";

  let status: "failed" | "read" | "delivered" | "sent" | null = null;
  let label: string | null = null;
  let color: string | null = null;

  if (message.error) {
    status = "failed";
    label = `Error code: ${message.error ?? "Unknown"} (click to copy)`;
    color = "red.500";
  } else if (message.readAt) {
    status = "read";
    label = `Read at ${formatTimestamp(message.readAt)}`;
    color = "green.600";
  } else if (message.deliveredAt) {
    status = "delivered";
    label = `Delivered at ${formatTimestamp(message.deliveredAt)}`;
    color = "gray.500";
  } else if (message.sentAt) {
    status = "sent";
    label = `Sent at ${formatTimestamp(message.sentAt)}`;
    color = "gray.500";
  }

  if (!status || !label || !color) {
    return null;
  }

  return (
    <Tooltip label={label} placement="top" hasArrow>
      <Text
        fontSize="xs"
        color={color}
        textAlign="right"
        flexShrink={0}
        minW="60px"
        cursor={status === "failed" ? "pointer" : "default"}
        onClick={() => {
          if (status === "failed" && message.error) {
            navigator.clipboard?.writeText(message.error).catch(() => {});
          }
        }}
      >
        {status}
      </Text>
    </Tooltip>
  );
}
