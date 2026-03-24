import { safeCapture } from "@/utils/safePosthog";

export const SUPPORT_WHATSAPP_NUMBER = "27642529039";

/**
 * Opens WhatsApp chat with the GovClerk support number.
 * @param message - Pre-filled message to send.
 * @param source - Analytics source identifier for tracking.
 */
export function openWhatsAppChat(message: string, source?: string) {
  if (source) {
    safeCapture("whatsapp_chat_opened", { source, message });
  }
  const link = `https://wa.me/+${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(link, "_blank", "noopener,noreferrer");
}
