import { getLeadFromDb } from "@/crm/leads";
import { readMetaConversionData } from "./utils";
import { sendConversionEvent } from "./sendConversionEvent";

export async function sendCompleteRegistrationConversionEvent(userId: string): Promise<void> {
  const data = await readMetaConversionData(userId);
  if (data == null || data.sentCompleteRegistration === 1) {
    return;
  }

  const lead = await getLeadFromDb(userId);
  let phone = lead?.phone;
  if (phone != null) {
    // Remove all non-numeric characters from the phone number
    phone = phone.replace(/\D/g, "");
  }

  await sendConversionEvent(
    {
      eventName: "CompleteRegistration",
      userId,
      email: data.email,
      fbc: data.fbc,
      fbp: data.fbp,
      clientIpAddress: data.clientIpAddress,
      clientUserAgent: data.clientUserAgent,
      firstName: data.firstName?.toLowerCase().trim(),
      ph: phone,
    },
    {}
  );
}
