import React from "react";
import useSWR from "swr";
import { Box, Heading, Spinner, Stack, Text } from "@chakra-ui/react";
import { asUtcDate } from "@/utils/date";
import type { ScheduledMessage } from "../../../admin/whatsapp/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ScheduledWhatsappsList() {
  const {
    data: scheduledMessages,
    error: scheduledError,
    isLoading: scheduledLoading,
  } = useSWR<ScheduledMessage[]>("/api/admin/get-scheduled-whatsapps", fetcher);

  return (
    <Box mt={0} borderWidth={1} borderRadius="lg" boxShadow="sm" p={6} bg="white">
      <Heading as="h4" size="sm" mb={2}>
        Scheduled WhatsApp Messages
      </Heading>
      {scheduledLoading ? (
        <Spinner size="sm" />
      ) : scheduledError ? (
        <Text color="red.500" fontSize="sm">
          Failed to load scheduled messages.
        </Text>
      ) : scheduledMessages && scheduledMessages.length > 0 ? (
        <Stack spacing={2}>
          {scheduledMessages.map((msg) => (
            <Box
              key={msg.whatsapp_id + msg.send_at}
              p={2}
              bg="gray.50"
              borderRadius="md"
              border="1px solid"
              borderColor="gray.200"
            >
              <Text fontSize="sm">
                <strong>To:</strong> {msg.whatsapp_id}
              </Text>
              <Text fontSize="sm">
                <strong>Time:</strong> {asUtcDate(msg.send_at).toLocaleString()}
              </Text>
              <Text fontSize="sm">
                <strong>Template ID:</strong> {msg.template_id}
              </Text>
              <Text fontSize="sm">
                <strong>Sent:</strong> {msg.is_sent ? "✅" : "⏳"}
              </Text>
              <Text fontSize="sm" color="gray.600">
                <strong>Sender:</strong> {msg.sender_user_id}
              </Text>
            </Box>
          ))}
        </Stack>
      ) : (
        <Text fontSize="sm" color="gray.500">
          No scheduled messages found.
        </Text>
      )}
    </Box>
  );
}
