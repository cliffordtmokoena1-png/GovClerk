export const WHATSAPP_BUSINESS_PHONE_TO_ID = {
  "27664259236": "1088830760969865",
  "16463311785": "816017321592140",
} as const;

export type BusinessWhatsappNumber = keyof typeof WHATSAPP_BUSINESS_PHONE_TO_ID;

// Lookup helper to resolve Cloud API phone_number_id from a business WhatsApp phone number.
export function getPhoneNumberIdFor(businessWhatsappId: string): string {
  const id = (WHATSAPP_BUSINESS_PHONE_TO_ID as Record<string, string>)[businessWhatsappId];
  if (!id) {
    throw new Error(
      `Unknown business WhatsApp number: ${businessWhatsappId}. Add it to WHATSAPP_BUSINESS_PHONE_TO_ID.`
    );
  }
  return id;
}

export const WHATSAPP_API_VERSION = "v23.0";
export const WHATSAPP_BUSINESS_ACCOUNT_ID = "3209327919215519";

// Old WATI-linked number
export const WATI_BUSINESS_PHONE_NUMBER = "16465874077";
