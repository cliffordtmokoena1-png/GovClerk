import React from "react";
import { Box, Heading } from "@chakra-ui/react";
import WhatsappFollowupForm from "./whatsapp/WhatsappFollowupForm";
import ScheduledWhatsappsList from "./whatsapp/ScheduledWhatsappsList";
import type { Template } from "@/admin/whatsapp/api/templates";

type Props = {
  whatsappMessageTemplates: Template[];
};

export default function WhatsappFollowupScheduler({ whatsappMessageTemplates }: Props) {
  return (
    <Box maxW="md" mx="auto" p={6}>
      <Heading as="h3" size="md" mb={2} textAlign="center">
        Automated Follow-up Scheduler
      </Heading>
      <Box textAlign="center" mb={6} color="gray.500" fontSize="sm">
        Automatically sends follow-up reminders when meeting minutes are due
      </Box>

      {/* Form Section */}
      <WhatsappFollowupForm whatsappMessageTemplates={whatsappMessageTemplates} />

      {/* Scheduled WhatsApp Messages List Section */}
      <ScheduledWhatsappsList />
    </Box>
  );
}
