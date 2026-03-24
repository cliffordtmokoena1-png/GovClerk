import { NextRequest } from "next/server";
import withErrorReporting from "@/error/withErrorReporting";
import { readMetaConversionData } from "@/meta/utils";
import { sendConversionEvent } from "@/meta/sendConversionEvent";
import { getLeadFromDb } from "@/crm/leads";

export const config = {
  runtime: "edge",
};

async function handler(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${process.env.UPLOAD_COMPLETE_WEBHOOK_SECRET}`) {
    return new Response(null, { status: 401 });
  }

  const body = await req.json();

  const {
    eventName,
    userId,
  }: {
    eventName: string;
    userId: string;
  } = body;

  if (eventName !== "CompleteRegistration") {
    // Right now only CompleteRegistration is supported.
    return new Response(null, { status: 400 });
  }

  const data = await readMetaConversionData(userId);
  if (data == null) {
    // No data found for this userId
    return new Response(null, { status: 404 });
  } else if (data.sentCompleteRegistration === 1) {
    // Already logged.  Avoid sending Meta a duplicate CompleteRegistration.
    return new Response(null, { status: 200 });
  }

  const lead = await getLeadFromDb(userId);
  let phone = lead?.phone;
  if (phone != null) {
    // Remove all non-numeric characters from the phone number
    phone = phone.replace(/\D/g, "");
  }

  await sendConversionEvent(
    {
      eventName,
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

  return new Response(null, { status: 200 });
}

export default withErrorReporting(handler);
